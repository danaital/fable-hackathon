import type { CellValue, FieldDef, Row } from "@/data/types";
import type { FilterRelation, FilterRule } from "@/features/report/viewState";
import { compileCompare } from "./compare";
import { usesRates, type FilterRates } from "./currency";
import { convertedTest, PASS, valueTest } from "./matchers";
import { hasComparison, isCompareRule, resolveOperator, VALUE_KIND, VALUE_SHAPE, type FilterSpec, type Operator } from "./operators";
import { periodBounds } from "./periods";
import { isEmptyCell, toBool } from "./values";

// The operator and period catalogues, for features that build or describe filters (export wizard, AI answers).
export * from "./operators";
export * from "./periods";
export { usesRates, type FilterRates } from "./currency";

export interface ApplyFiltersInput {
  rows: readonly Row[];
  filters: readonly FilterRule[];
  relation: FilterRelation;
  fields: readonly FieldDef[];
  /** "Now" for preset time periods; injectable so tests are stable. */
  now?: Date;
  /** Exchange rates for amount filters typed in their own currency. While absent, those rules are not applied. */
  rates?: FilterRates | null;
}

type Predicate = (row: Row) => boolean;

export const MIN_FILTERS_FOR_FLEX = 3;
const EQUALITY: ReadonlySet<Operator> = new Set<Operator>(["equals", "notEquals"]);
const TEMPORAL_KINDS: ReadonlySet<string> = new Set(["date", "datetime"]);

const isOn = (rule: FilterRule) => rule.enabled !== false;

/**
 * The relation that is really applied. FLEX needs at least three filters that are switched on;
 * with fewer it becomes AND when one of them is mandatory, otherwise OR.
 */
export function effectiveRelation(filters: readonly FilterRule[], relation: FilterRelation): FilterRelation {
  const on = filters.filter(isOn);
  if (relation !== "flex" || on.length >= MIN_FILTERS_FOR_FLEX) return relation;
  return on.some((rule) => rule.mandatory) ? "and" : "or";
}

interface RuleValuesInput {
  rule: FilterSpec;
  field: FieldDef;
  now: Date;
}

/** The values a rule compares with: a preset period on a range operator is turned into dates here, against `now`. */
export function ruleValues({ rule, field, now }: RuleValuesInput): readonly CellValue[] {
  if (VALUE_SHAPE[resolveOperator(rule, field)] !== "range" || !TEMPORAL_KINDS.has(VALUE_KIND[field.type])) return rule.values;
  return periodBounds({ period: rule.period, fieldType: field.type, now }) ?? rule.values;
}

export interface CompileRuleInput {
  rule: FilterSpec;
  fields: ReadonlyMap<string, FieldDef>;
  now: Date;
  rates?: FilterRates | null;
}

/** The row test for one rule, or `null` when the rule does not apply (switched off, unknown field, nothing to compare). */
export function compileRule({ rule, fields, now, rates }: CompileRuleInput): Predicate | null {
  const field = fields.get(rule.field);
  if (!isOn(rule) || !field) return null;
  if (isCompareRule(rule)) return compileCompare({ rule, field, other: fields.get(rule.compareField ?? "") });

  const operator = resolveOperator(rule, field);
  const values = ruleValues({ rule, field, now });
  if (VALUE_SHAPE[operator] === "null") {
    // "Is empty: No" means "has a value", and the other way round.
    const wantsEmpty = (operator === "isNull") === (toBool(values[0]) !== false);
    return (row) => isEmptyCell(row[field.key]) === wantsEmpty;
  }

  const kind = VALUE_KIND[field.type];
  const compared = hasComparison(operator, values);
  const keepEmpty = rule.includeNoValues !== false;
  if (!compared && keepEmpty) return null;
  const converts = compared && usesRates(rule, field);
  // Rates still loading: wait instead of filtering on unconverted amounts.
  if (converts && !rates) return null;

  let test = PASS;
  if (converts && rates) test = convertedTest({ operator, values, currency: String(rule.currency?.targetCurrency), currencyKey: field.currencyKey, rates });
  else if (compared) test = valueTest({ kind, operator, values });
  // Rows with no value are kept by default; "contains", yes/no equality and "exclude empty" drop them.
  const emptyPasses = keepEmpty && operator !== "contains" && !(kind === "boolean" && EQUALITY.has(operator));

  return (row) => {
    const cell = row[field.key];
    return isEmptyCell(cell) ? emptyPasses : test(cell, row);
  };
}

interface Compiled {
  test: Predicate;
  mandatory: boolean;
}

const COMBINE: Record<FilterRelation, (compiled: readonly Compiled[], row: Row) => boolean> = {
  and: (compiled, row) => compiled.every(({ test }) => test(row)),
  or: (compiled, row) => compiled.some(({ test }) => test(row)),
  // Every mandatory filter must match, and so must at least one of the others (when there are others).
  flex: (compiled, row) => {
    const optional = compiled.filter(({ mandatory }) => !mandatory);
    const required = compiled.filter(({ mandatory }) => mandatory);
    return required.every(({ test }) => test(row)) && (optional.length === 0 || optional.some(({ test }) => test(row)));
  },
};

export function applyFilters({ rows, filters, relation, fields, now = new Date(), rates }: ApplyFiltersInput): readonly Row[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const compiled = filters.flatMap((rule): Compiled[] => {
    const test = compileRule({ rule, fields: byKey, now, rates });
    return test ? [{ test, mandatory: rule.mandatory === true }] : [];
  });
  if (compiled.length === 0) return rows;
  const combine = COMBINE[effectiveRelation(filters, relation)];
  return rows.filter((row) => combine(compiled, row));
}
