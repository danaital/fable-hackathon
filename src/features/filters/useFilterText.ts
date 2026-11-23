"use client";

import { useMemo } from "react";
import type { CellValue, FieldDef } from "@/data/types";
import { useReport } from "@/features/report/ReportContext";
import { useI18n, type I18nKey } from "@/i18n";
import {
  isBlank,
  isCompareRule,
  isFieldOperator,
  resolveOperator,
  resultType,
  VALUE_KIND,
  VALUE_SHAPE,
  valueKind,
  type FilterSpec,
  type Operator,
  type ValueKind,
} from "./operators";
import { isTimePeriod } from "./periods";
import { parseDate, toBool, toNumber } from "./values";

const LIST_JOIN = ", ";

// Dates read better with "after / before" than with "greater / less".
const DATE_OPERATOR_KEY: Partial<Record<Operator, I18nKey>> = {
  greaterThan: "filters.op.date.greaterThan",
  greaterThanOrEqual: "filters.op.date.greaterThanOrEqual",
  lessThan: "filters.op.date.lessThan",
  lessThanOrEqual: "filters.op.date.lessThanOrEqual",
};
const OPPOSITE_NULL: Partial<Record<Operator, Operator>> = { isNull: "isNotNull", isNotNull: "isNull" };
const TEMPORAL: ReadonlySet<ValueKind> = new Set<ValueKind>(["date", "datetime"]);

export interface FilterText {
  fieldLabel: (key: string | undefined) => string;
  /** The field label, or "A minus B" for a field-to-field rule. */
  title: (rule: FilterSpec) => string;
  operatorLabel: (operator: Operator, field: FieldDef, rule: FilterSpec) => string;
  /** Label of one option of an enum, status or country field. */
  optionLabel: (field: FieldDef, value: string) => string;
  /** Operator and value as the reader would say them; `value` is empty when the operator says it all. */
  describe: (rule: FilterSpec, field: FieldDef) => { operator: string; value: string };
}

/** Wording for cards and chips, in the current language and number/date formats. */
export function useFilterText(): FilterText {
  const { t, tData } = useI18n();
  const { report, format } = useReport();

  return useMemo(() => {
    const fields = new Map(report.fields.map((field) => [field.key, field]));
    const fieldLabel = (key: string | undefined) => {
      const field = fields.get(key ?? "");
      return field ? t(field.labelKey) : (key ?? "");
    };

    const optionLabel = (field: FieldDef, value: string) => {
      if (field.type === "country") return format.country(value);
      return field.optionPrefix ? tData(field.optionPrefix, value) : value;
    };

    const FORMAT: Record<ValueKind, (value: CellValue, field: FieldDef) => string> = {
      text: (value) => String(value),
      number: (value) => (Number.isNaN(toNumber(value)) ? String(value) : format.number(toNumber(value))),
      date: (value) => (parseDate(value) ? format.date(String(value)) : String(value)),
      datetime: (value) => (parseDate(value) ? format.dateTime(String(value)) : String(value)),
      boolean: (value) => (toBool(value) === null ? String(value) : t(toBool(value) ? "bool.yes" : "bool.no")),
      option: (value, field) => optionLabel(field, String(value)),
    };

    const operatorLabel = (operator: Operator, field: FieldDef, rule: FilterSpec) => {
      const dateKey = !isCompareRule(rule) && TEMPORAL.has(VALUE_KIND[field.type]) ? DATE_OPERATOR_KEY[operator] : undefined;
      return t(dateKey ?? `filters.op.${operator}`);
    };

    const title = (rule: FilterSpec) => {
      if (!isCompareRule(rule)) return fieldLabel(rule.field);
      const operator = isFieldOperator(rule.fieldOperator) ? t(`filters.fieldOp.${rule.fieldOperator}`) : "";
      return t("filters.compare.title", { a: fieldLabel(rule.field), operator, b: fieldLabel(rule.compareField) });
    };

    const describe = (rule: FilterSpec, field: FieldDef) => {
      const operator = resolveOperator(rule, field);
      const shape = VALUE_SHAPE[operator];
      if (shape === "null") {
        // "Is empty: No" reads as "has a value".
        const shown = toBool(rule.values[0]) === false ? (OPPOSITE_NULL[operator] ?? operator) : operator;
        return { operator: operatorLabel(shown, field, rule), value: "" };
      }
      const label = operatorLabel(operator, field, rule);
      if (shape === "range" && isTimePeriod(rule.period)) return { operator: label, value: t(`filters.period.${rule.period}`) };

      const kind = valueKind(rule, field);
      const shown = rule.values.map((value) => (isBlank(value) ? "" : FORMAT[kind](value, field)));
      const currency = rule.currency?.targetCurrency ? ` ${rule.currency.targetCurrency}` : "";
      const none = t("filters.chip.noValue");

      if (shape === "list") return { operator: label, value: shown.filter(Boolean).join(LIST_JOIN) || none };
      if (shape === "single") {
        // A yes/no field comparison with no expected result needs no words after the title.
        if (!shown[0] && resultType(rule) === "boolean") return { operator: "", value: "" };
        return { operator: label, value: shown[0] ? `${shown[0]}${currency}` : none };
      }
      const [from = "", to = ""] = shown;
      if (from && to) return { operator: label, value: `${t("filters.chip.range", { from, to })}${currency}` };
      if (from) return { operator: label, value: `${t("filters.chip.from", { from })}${currency}` };
      return { operator: label, value: to ? `${t("filters.chip.to", { to })}${currency}` : none };
    };

    return { fieldLabel, title, operatorLabel, optionLabel, describe };
  }, [report.fields, format, t, tData]);
}
