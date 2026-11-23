import type { CellValue, FieldDef, Row } from "@/data/types";
import { ruleValues } from "./engine";
import {
  DEFAULT_OPERATOR,
  DEFAULT_RESULT_OPERATOR,
  FIELD_OPERATOR_RESULT,
  isBlank,
  isCompareRule,
  isFieldOperator,
  resolveOperator,
  VALUE_KIND,
  VALUE_SHAPE,
  valueKind,
  type FieldOperator,
  type FilterSpec,
  type Operator,
  type ValueKind,
  type ValueShape,
} from "./operators";
import { dayPoint, instantPoint, toNumber, type Point } from "./values";

/** Edits to a rule, as pure functions: the toolbar stores whatever these return. */

const ID_RADIX = 36;
let created = 0;
// Not crypto.randomUUID: it is missing on plain-http origins, such as a phone testing over the local network.
const newId = () => `f-${Date.now().toString(ID_RADIX)}-${(created += 1)}`;

export const createRule = (field: FieldDef): FilterSpec => ({ id: newId(), field: field.key, operator: DEFAULT_OPERATOR[field.type], values: [] });

interface CompareInput {
  field: string;
  fieldOperator: FieldOperator;
  compareField: string;
}

export const createCompareRule = ({ field, fieldOperator, compareField }: CompareInput): FilterSpec => ({
  id: newId(),
  field,
  compareField,
  fieldOperator,
  operator: DEFAULT_RESULT_OPERATOR[FIELD_OPERATOR_RESULT[fieldOperator]],
  values: [],
});

/** Two field-to-field rules are the same filter when they combine the same fields the same way. */
export const sameCompare = (rule: FilterSpec, { field, fieldOperator, compareField }: CompareInput): boolean =>
  rule.field === field && rule.fieldOperator === fieldOperator && rule.compareField === compareField;

/** Incomplete field-to-field rule: it cannot be applied, and the card says so. */
export const isInvalid = (rule: FilterSpec, fields: ReadonlyMap<string, FieldDef>): boolean =>
  isCompareRule(rule) && (!isFieldOperator(rule.fieldOperator) || !fields.has(rule.compareField ?? ""));

const CONVERT: Record<ValueShape, (values: CellValue[], from: ValueShape) => CellValue[]> = {
  null: () => [true],
  single: (values) => values.slice(0, 1),
  range: (values, from) => (from === "range" ? values : [values[0] ?? null, null]),
  list: (values, from) => (from === "list" ? values : values.slice(0, 1).filter((value) => !isBlank(value))),
};

interface WithOperatorInput {
  rule: FilterSpec;
  field: FieldDef;
  operator: Operator;
}

/** Changing the operator keeps as much of the typed value as the new operator can use. */
export function withOperator({ rule, field, operator }: WithOperatorInput): FilterSpec {
  const from = VALUE_SHAPE[resolveOperator(rule, field)];
  const shape = VALUE_SHAPE[operator];
  // The "yes" of an "is empty" rule is not a value to carry over.
  const values = CONVERT[shape](from === "null" ? [] : rule.values, from);
  // A preset period only drives a range, so it does not survive a move to another operator.
  return { ...rule, operator, values, period: shape === "range" ? rule.period : undefined };
}

interface WithPeriodInput {
  rule: FilterSpec;
  field: FieldDef;
  period: string | undefined;
  now: Date;
}

/** A preset period needs a range operator ("not between" is kept). Back to custom keeps the dates the period stood for. */
export function withPeriod({ rule, field, period, now }: WithPeriodInput): FilterSpec {
  if (period === undefined) return { ...rule, period, values: [...ruleValues({ rule, field, now })] };
  const operator = resolveOperator(rule, field) === "notBetween" ? "notBetween" : "between";
  return { ...rule, operator, period, values: [] };
}

/** Clears the value, the period and the currency, and keeps the card. */
export function cleared(rule: FilterSpec, field: FieldDef): FilterSpec {
  const values = VALUE_SHAPE[resolveOperator(rule, field)] === "null" ? [true] : [];
  return { ...rule, values, period: undefined, currency: undefined };
}

export function isCleared(rule: FilterSpec): boolean {
  return rule.values.every(isBlank) && rule.period === undefined && rule.currency === undefined;
}

const RANGE_POINT: Partial<Record<ValueKind, Point>> = { number: toNumber, date: dayPoint, datetime: instantPoint(false) };

/** True when a range has both ends and they are the wrong way round. */
export function isRangeReversed(rule: FilterSpec, field: FieldDef): boolean {
  if (VALUE_SHAPE[resolveOperator(rule, field)] !== "range" || rule.period !== undefined) return false;
  const point = RANGE_POINT[isCompareRule(rule) ? valueKind(rule, field) : VALUE_KIND[field.type]];
  return point ? point(rule.values[0]) > point(rule.values[1]) : false;
}

interface DistinctInput {
  rows: readonly Row[];
  key: string;
  locale: string;
}

/** Values a field really holds: no empties, one entry per spelling (the first casing wins), sorted for the reader. */
export function distinctValues({ rows, key, locale }: DistinctInput): string[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const value = row[key];
    if (value === null || value === undefined || value === "") continue;
    const text = String(value);
    const lowered = text.toLowerCase();
    if (!seen.has(lowered)) seen.set(lowered, text);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, locale, { numeric: true }));
}
