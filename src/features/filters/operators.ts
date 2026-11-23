import type { CellValue, FieldDef, FieldType } from "@/data/types";
import type { FilterRule } from "@/features/report/viewState";

/**
 * FilterRule plus three optional fields the filter behavior needs and viewState does not carry yet.
 * They ride along as extra properties of the same object, so a rule without them still works.
 */
export interface FilterSpec extends FilterRule {
  /** `false` drops rows whose cell is empty. Absent means such rows are kept. */
  includeNoValues?: boolean;
  /** Field-to-field: how `field` and `compareField` are combined before `operator` tests the result. */
  fieldOperator?: string;
  /** Amount filters: the currency the filter value is typed in. Absent means "as shown in the table" (no conversion). */
  currency?: { targetCurrency?: string };
}

export const OPERATORS = [
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "between",
  "notBetween",
  "in",
  "notIn",
  "isNull",
  "isNotNull",
] as const;
export type Operator = (typeof OPERATORS)[number];

/** How many values an operator reads from `FilterRule.values`. */
export type ValueShape = "single" | "range" | "list" | "null";

export const VALUE_SHAPE: Record<Operator, ValueShape> = {
  equals: "single",
  notEquals: "single",
  contains: "single",
  notContains: "single",
  startsWith: "single",
  endsWith: "single",
  greaterThan: "single",
  greaterThanOrEqual: "single",
  lessThan: "single",
  lessThanOrEqual: "single",
  between: "range",
  notBetween: "range",
  in: "list",
  notIn: "list",
  isNull: "null",
  isNotNull: "null",
};

const NULL_OPS = ["isNull", "isNotNull"] as const;
const COMPARE_OPS = ["equals", "notEquals", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"] as const;
const STRING_OPS: readonly Operator[] = ["contains", "equals", "notEquals", "notContains", "startsWith", "endsWith", "in", "notIn", ...NULL_OPS];
const NUMBER_OPS: readonly Operator[] = [...COMPARE_OPS, "between", ...NULL_OPS];
const DATE_OPS: readonly Operator[] = [...COMPARE_OPS, "between", "notBetween", ...NULL_OPS];
const OPTION_OPS: readonly Operator[] = ["equals", "notEquals", "in", "notIn", ...NULL_OPS];

/** Operators offered for each field type, in menu order. Reused by the export wizard and AI answers. */
export const OPERATORS_BY_TYPE: Record<FieldType, readonly Operator[]> = {
  string: STRING_OPS,
  number: NUMBER_OPS,
  currency: NUMBER_OPS,
  percent: NUMBER_OPS,
  date: DATE_OPS,
  datetime: DATE_OPS,
  boolean: ["equals", "notEquals", ...NULL_OPS],
  enum: OPTION_OPS,
  status: OPTION_OPS,
  // Countries are a closed list of codes, so they filter like an enum rather than like free text.
  country: OPTION_OPS,
  email: ["equals", "notEquals", "contains", "notContains", "endsWith", ...NULL_OPS],
};

export const DEFAULT_OPERATOR: Record<FieldType, Operator> = {
  string: "contains",
  number: "equals",
  currency: "equals",
  percent: "equals",
  date: "between",
  datetime: "between",
  boolean: "equals",
  enum: "equals",
  status: "equals",
  country: "equals",
  email: "equals",
};

export const FIELD_OPERATORS = [
  "fieldEquals",
  "fieldNotEquals",
  "fieldGreaterThan",
  "fieldGreaterThanOrEqual",
  "fieldLessThan",
  "fieldLessThanOrEqual",
  "fieldContains",
  "fieldNotContains",
  "fieldStartsWith",
  "fieldEndsWith",
  "fieldSubtract",
  "fieldAdd",
  "fieldMultiply",
  "fieldDivide",
  "fieldConcat",
] as const;
export type FieldOperator = (typeof FIELD_OPERATORS)[number];

/** What combining two fields produces; it decides which operators and value editor come next. */
export type ResultType = "boolean" | "number" | "string";

export const FIELD_OPERATOR_RESULT: Record<FieldOperator, ResultType> = {
  fieldEquals: "boolean",
  fieldNotEquals: "boolean",
  fieldGreaterThan: "boolean",
  fieldGreaterThanOrEqual: "boolean",
  fieldLessThan: "boolean",
  fieldLessThanOrEqual: "boolean",
  fieldContains: "boolean",
  fieldNotContains: "boolean",
  fieldStartsWith: "boolean",
  fieldEndsWith: "boolean",
  fieldSubtract: "number",
  fieldAdd: "number",
  fieldMultiply: "number",
  fieldDivide: "number",
  fieldConcat: "string",
};

const FIELD_EQUALITY = ["fieldEquals", "fieldNotEquals"] as const;
const FIELD_ORDER = [...FIELD_EQUALITY, "fieldGreaterThan", "fieldGreaterThanOrEqual", "fieldLessThan", "fieldLessThanOrEqual"] as const;
const FIELD_MONEY: readonly FieldOperator[] = [...FIELD_ORDER, "fieldSubtract", "fieldAdd"];
const FIELD_DATE: readonly FieldOperator[] = [...FIELD_ORDER, "fieldSubtract"];

export const FIELD_OPERATORS_BY_TYPE: Record<FieldType, readonly FieldOperator[]> = {
  string: [...FIELD_EQUALITY, "fieldContains", "fieldNotContains", "fieldStartsWith", "fieldEndsWith", "fieldConcat"],
  number: [...FIELD_ORDER, "fieldSubtract", "fieldAdd", "fieldMultiply", "fieldDivide"],
  currency: FIELD_MONEY,
  percent: FIELD_MONEY,
  date: FIELD_DATE,
  datetime: FIELD_DATE,
  boolean: FIELD_EQUALITY,
  enum: FIELD_EQUALITY,
  status: FIELD_EQUALITY,
  country: FIELD_EQUALITY,
  email: [...FIELD_EQUALITY, "fieldContains", "fieldConcat"],
};

/** Operators that test the result of a field-to-field combination. */
export const RESULT_OPERATORS: Record<ResultType, readonly Operator[]> = {
  boolean: ["equals", "notEquals"],
  number: [...COMPARE_OPS, "between"],
  string: ["equals", "notEquals", "contains", "notContains", "startsWith", "endsWith"],
};

export const DEFAULT_RESULT_OPERATOR: Record<ResultType, Operator> = {
  boolean: "equals",
  number: "greaterThan",
  string: "contains",
};

/** Which value editor and which comparison rules a value gets. */
export type ValueKind = "text" | "number" | "date" | "datetime" | "boolean" | "option";

export const VALUE_KIND: Record<FieldType, ValueKind> = {
  string: "text",
  email: "text",
  number: "number",
  currency: "number",
  percent: "number",
  date: "date",
  datetime: "datetime",
  boolean: "boolean",
  enum: "option",
  status: "option",
  country: "option",
};

const RESULT_VALUE_KIND: Record<ResultType, ValueKind> = { boolean: "boolean", number: "number", string: "text" };

export const isOperator = (value: string): value is Operator => (OPERATORS as readonly string[]).includes(value);
export const isFieldOperator = (value: string | undefined): value is FieldOperator =>
  value !== undefined && (FIELD_OPERATORS as readonly string[]).includes(value);

/** A filter value is blank when there is nothing to compare with. `0` and `false` are real values. */
export const isBlank = (value: CellValue | undefined): boolean =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

/** A field-to-field rule compares two fields of the same row instead of one field with a typed value. */
export const isCompareRule = (rule: FilterSpec): boolean => rule.compareField !== undefined || rule.fieldOperator !== undefined;

/** Result type of a field-to-field rule, or `null` when the rule is not one (or its field operator is unknown). */
export const resultType = (rule: FilterSpec): ResultType | null =>
  isFieldOperator(rule.fieldOperator) ? FIELD_OPERATOR_RESULT[rule.fieldOperator] : null;

export function offeredOperators(rule: FilterSpec, field: FieldDef): readonly Operator[] {
  const result = resultType(rule);
  return result ? RESULT_OPERATORS[result] : OPERATORS_BY_TYPE[field.type];
}

/** The operator that is really applied: one the field type does not support falls back to the type's default. */
export function resolveOperator(rule: FilterSpec, field: FieldDef): Operator {
  const { operator } = rule;
  if (isOperator(operator) && offeredOperators(rule, field).includes(operator)) return operator;
  const result = resultType(rule);
  return result ? DEFAULT_RESULT_OPERATOR[result] : DEFAULT_OPERATOR[field.type];
}

export function valueKind(rule: FilterSpec, field: FieldDef): ValueKind {
  const result = resultType(rule);
  return result ? RESULT_VALUE_KIND[result] : VALUE_KIND[field.type];
}

/** True when the operator has something to compare with; without it the rule does not constrain rows. */
export function hasComparison(operator: Operator, values: readonly CellValue[]): boolean {
  const shape = VALUE_SHAPE[operator];
  if (shape === "null") return true;
  return shape === "single" ? !isBlank(values[0]) : values.some((value) => !isBlank(value));
}
