import type { CellValue } from "@/data/types";
import { mean } from "./aggregate";
import type { Aggregation, ConditionRule, DisplayCondition } from "./config";
import { isBlank, toNumber, type Rows } from "./values";

export const CONDITION_OUTCOMES = ["met", "notScoped", "notMet"] as const;
/** "notScoped": the rows are not narrowed to one value yet. "notMet": a rule failed. Both withhold the value. */
export type ConditionOutcome = (typeof CONDITION_OUTCOMES)[number];

type Operator = ConditionRule["operator"];
type Comparable = number | string;
const ISO_DAY_LENGTH = 10;

/** Numbers compare as numbers; anything else as text, where dates compare by their day and yes/no by "true"/"false". */
function comparable(value: CellValue | undefined): Comparable | null {
  if (isBlank(value)) return null;
  if (typeof value === "boolean") return String(value);
  return toNumber(value) ?? String(value).slice(0, ISO_DAY_LENGTH);
}

const inRange = (actual: Comparable, { value, valueTo }: ConditionRule) => {
  const [from, to] = [comparable(value), comparable(valueTo)];
  return (from === null || actual >= from) && (to === null || actual <= to);
};

/** Tests one value against a rule. Operators that need a value fail without one. */
const TESTS: Partial<Record<Operator, (actual: Comparable, rule: ConditionRule) => boolean>> = {
  equals: (actual, { value }) => actual === comparable(value),
  notEquals: (actual, { value }) => actual !== comparable(value),
  greaterThan: (actual, { value }) => actual > (comparable(value) ?? actual),
  greaterThanOrEqual: (actual, { value }) => comparable(value) !== null && actual >= (comparable(value) ?? actual),
  lessThan: (actual, { value }) => actual < (comparable(value) ?? actual),
  lessThanOrEqual: (actual, { value }) => comparable(value) !== null && actual <= (comparable(value) ?? actual),
  between: inRange,
  notBetween: (actual, rule) => !inRange(actual, rule),
  in: (actual, { values = [] }) => values.some((value) => comparable(value) === actual),
  notIn: (actual, { values = [] }) => !values.some((value) => comparable(value) === actual),
};

const AGGREGATE: Record<Aggregation, (numbers: readonly number[]) => number> = {
  count: (numbers) => numbers.length,
  sum: (numbers) => numbers.reduce((total, n) => total + n, 0),
  average: mean,
  min: (numbers) => numbers.reduce((low, n) => Math.min(low, n)),
  max: (numbers) => numbers.reduce((high, n) => Math.max(high, n)),
};

function ruleHolds(rule: ConditionRule, rows: Rows): boolean {
  const test = TESTS[rule.operator];
  if (rule.subject === "rowCount") return test?.(rows.length, rule) ?? false;
  const cells = rows.map((row) => row[rule.field ?? ""]);
  if (rule.operator === "isNull") return cells.every(isBlank);
  if (rule.operator === "isNotNull") return cells.length > 0 && !cells.some(isBlank);
  if (!test) return false;
  if (rule.valueKind === "number") {
    const numbers = cells.flatMap((cell) => toNumber(cell) ?? []);
    // A number rule with no numbers to judge fails.
    return numbers.length > 0 && test(AGGREGATE[rule.aggregation](numbers), rule);
  }
  // Date, category and yes/no rules test each non-empty cell.
  const values = cells.flatMap((cell) => comparable(cell) ?? []);
  return rule.match === "any" ? values.some((value) => test(value, rule)) : values.every((value) => test(value, rule));
}

const holdsOneValue = (rows: Rows, key: string) => new Set(rows.map((row) => row[key]).filter((cell) => !isBlank(cell))).size === 1;

/** Judges a display condition on the rows the page shows. An absent condition is met. */
export function evaluateCondition(condition: DisplayCondition | undefined, rows: Rows): ConditionOutcome {
  if (!condition) return "met";
  const scope = condition.requireSingleValueOn ?? [];
  if (scope.length > 0 && !scope.some((key) => holdsOneValue(rows, key))) return "notScoped";
  // Incomplete rules (a field rule that names no field) are skipped, not failed.
  const rules = (condition.rules ?? []).filter((rule) => rule.subject === "rowCount" || rule.field);
  if (rules.length === 0) return "met";
  const results = rules.map((rule) => ruleHolds(rule, rows));
  return (condition.relation === "or" ? results.some(Boolean) : results.every(Boolean)) ? "met" : "notMet";
}
