import type { CellValue, FieldDef } from "@/data/types";
import { VALUE_SHAPE, isBlank, isOperator, type FilterSpec, type ValueShape } from "@/features/filters/engine";
import type { SortRule } from "@/features/grid/sort";
import type { FilterRule } from "@/features/report/viewState";
import type { Translate, TranslateData } from "./translate";

export interface DescribeEnv {
  fields: readonly FieldDef[];
  t: Translate;
  tData: TranslateData;
}

// Operator and period wording belongs to the filters feature; its message keys are looked up by name.
export const OPERATOR_PREFIX = "filters.op";
export const FIELD_OPERATOR_PREFIX = "filters.fieldOp";
export const PERIOD_PREFIX = "filters.period";
const RANGE_SEPARATOR = " – ";
const LIST_SEPARATOR = ", ";

export function fieldLabel(key: string, { fields, t }: DescribeEnv): string {
  const field = fields.find((candidate) => candidate.key === key);
  return field ? t(field.labelKey) : key;
}

function valueText(value: CellValue, field: FieldDef | undefined, { t, tData }: DescribeEnv): string {
  if (typeof value === "boolean") return t(value ? "bool.yes" : "bool.no");
  return field?.optionPrefix ? tData(field.optionPrefix, String(value)) : String(value ?? "");
}

const JOIN: Record<ValueShape, (values: string[]) => string> = {
  null: () => "",
  single: (values) => values[0] ?? "",
  range: (values) => values.join(RANGE_SEPARATOR),
  list: (values) => values.join(LIST_SEPARATOR),
};

/** One filter as a sentence: "Status is one of Late, Returned". */
export function describeFilter(rule: FilterRule, env: DescribeEnv): string {
  const spec: FilterSpec = rule;
  const field = env.fields.find((candidate) => candidate.key === rule.field);
  const subject = spec.compareField
    ? [fieldLabel(rule.field, env), env.tData(FIELD_OPERATOR_PREFIX, spec.fieldOperator ?? ""), fieldLabel(spec.compareField, env)].join(" ")
    : fieldLabel(rule.field, env);
  const operator = env.tData(OPERATOR_PREFIX, rule.operator);
  if (rule.period) return `${subject} ${operator} ${env.tData(PERIOD_PREFIX, rule.period)}`;
  const shape = isOperator(rule.operator) ? VALUE_SHAPE[rule.operator] : "list";
  const values = rule.values.filter((value) => !isBlank(value)).map((value) => valueText(value, spec.compareField ? undefined : field, env));
  // A field-to-field test with nothing to compare its result with reads as the test alone.
  if (spec.compareField && values.length === 0) return subject;
  return [subject, operator, JOIN[shape](values)].filter(Boolean).join(" ");
}

/** One sort as text: "Order date (descending)". */
export function describeSort(rule: SortRule, env: DescribeEnv): string {
  return `${fieldLabel(rule.key, env)} (${env.t(rule.direction === "asc" ? "export.sort.asc" : "export.sort.desc")})`;
}
