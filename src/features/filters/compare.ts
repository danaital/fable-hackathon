import type { CellValue, FieldDef, Row } from "@/data/types";
import { valueTest } from "./matchers";
import {
  FIELD_OPERATOR_RESULT,
  hasComparison,
  isFieldOperator,
  resolveOperator,
  valueKind,
  type FieldOperator,
  type FilterSpec,
} from "./operators";
import { toDateString } from "./periods";
import { DAY_MS, isEmptyCell, lower, parseDate, toNumber } from "./values";

/** Field-to-field rules: combine two fields of the same row, then test the result. */

const NO_ROW: Row = {};
const TEMPORAL_TYPES: ReadonlySet<string> = new Set(["date", "datetime"]);

const same = (a: CellValue, b: CellValue) => (typeof a === "string" && typeof b === "string" ? lower(a) === lower(b) : a === b);

/** Numbers by value, then dates by instant, then plain text. */
function order(a: CellValue, b: CellValue): number {
  const [x, y] = [toNumber(a), toNumber(b)];
  if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  const [from, to] = [parseDate(a), parseDate(b)];
  if (from && to) return from.date.getTime() - to.date.getTime();
  const [left, right] = [String(a), String(b)];
  return Number(left > right) - Number(left < right);
}

/** Numbers subtract as numbers, dates as (fractional) days. */
function subtract(a: CellValue, b: CellValue): number {
  const [x, y] = [toNumber(a), toNumber(b)];
  if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  const [from, to] = [parseDate(a), parseDate(b)];
  return from && to ? (from.date.getTime() - to.date.getTime()) / DAY_MS : Number.NaN;
}

const COMBINE: Record<FieldOperator, (a: CellValue, b: CellValue) => CellValue> = {
  fieldEquals: same,
  fieldNotEquals: (a, b) => !same(a, b),
  fieldGreaterThan: (a, b) => order(a, b) > 0,
  fieldGreaterThanOrEqual: (a, b) => order(a, b) >= 0,
  fieldLessThan: (a, b) => order(a, b) < 0,
  fieldLessThanOrEqual: (a, b) => order(a, b) <= 0,
  fieldContains: (a, b) => lower(a).includes(lower(b)),
  fieldNotContains: (a, b) => !lower(a).includes(lower(b)),
  fieldStartsWith: (a, b) => lower(a).startsWith(lower(b)),
  fieldEndsWith: (a, b) => lower(a).endsWith(lower(b)),
  fieldSubtract: subtract,
  fieldAdd: (a, b) => toNumber(a) + toNumber(b),
  fieldMultiply: (a, b) => toNumber(a) * toNumber(b),
  fieldDivide: (a, b) => (toNumber(b) === 0 ? Number.NaN : toNumber(a) / toNumber(b)),
  fieldConcat: (a, b) => `${String(a)}${String(b)}`,
};

/** A date compared with a date-time compares by calendar day. */
const dayOf = (value: CellValue): CellValue => {
  const parsed = parseDate(value);
  return parsed ? toDateString(parsed.date) : value;
};

interface CompileCompareInput {
  rule: FilterSpec;
  field: FieldDef;
  other: FieldDef | undefined;
}

/** `null` when the rule has nothing to test, or is incomplete: a broken rule never hides rows. */
export function compileCompare({ rule, field, other }: CompileCompareInput): ((row: Row) => boolean) | null {
  const { fieldOperator } = rule;
  if (!other || !isFieldOperator(fieldOperator)) return null;
  const result = FIELD_OPERATOR_RESULT[fieldOperator];
  const operator = resolveOperator(rule, field);
  const compared = hasComparison(operator, rule.values);
  const keepEmpty = rule.includeNoValues !== false;
  // A yes/no result is its own verdict; a number or text result needs a value to be tested against.
  if (result !== "boolean" && !compared && keepEmpty) return null;

  const combine = COMBINE[fieldOperator];
  const test = compared ? valueTest({ kind: valueKind(rule, field), operator, values: rule.values }) : null;
  const byDay = field.type !== other.type && TEMPORAL_TYPES.has(field.type) && TEMPORAL_TYPES.has(other.type);

  return (row) => {
    const a = row[field.key];
    const b = row[other.key];
    if (isEmptyCell(a) || isEmptyCell(b)) return keepEmpty;
    const value = byDay ? combine(dayOf(a), dayOf(b)) : combine(a, b);
    if (!test) return value !== false;
    // An impossible calculation (text in a sum, division by zero) never matches.
    if (typeof value === "number" && Number.isNaN(value)) return false;
    return test(value, NO_ROW);
  };
}
