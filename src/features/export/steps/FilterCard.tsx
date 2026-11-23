"use client";

import { Trash2 } from "lucide-react";
import { Button, Card, Checkbox, Field, Input, Select, Stack, Text } from "@/components/ui";
import type { CellValue, FieldDef, Row } from "@/data/types";
import {
  FIELD_OPERATORS_BY_TYPE,
  PERIODS_BY_TYPE,
  VALUE_SHAPE,
  isFieldOperator,
  offeredOperators,
  resolveOperator,
  valueKind,
  type FilterSpec,
  type ValueKind,
} from "@/features/filters/engine";
import { createCompareRule, distinctValues, withOperator, withPeriod } from "@/features/filters/rules";
import { useReport } from "@/features/report/ReportContext";
import { useI18n } from "@/i18n";
import { FIELD_OPERATOR_PREFIX, OPERATOR_PREFIX, PERIOD_PREFIX, fieldLabel } from "../describe";
import { ICON_SIZE, Option, toggleItem } from "../ui";

const TRUE = "true";
const FALSE = "false";
const ANY = "";
const CUSTOM_DATES = "";
const LIST_SEPARATOR = ",";
const INPUT_TYPE: Record<ValueKind, string> = { text: "text", option: "text", boolean: "text", number: "number", date: "date", datetime: "datetime-local" };

interface Choice {
  value: string;
  label: string;
}

interface ValueInputProps {
  kind: ValueKind;
  value: CellValue | undefined;
  label: string;
  choices: readonly Choice[];
  onChange: (value: CellValue) => void;
}

function ValueInput({ kind, value, label, choices, onChange }: ValueInputProps) {
  const { t } = useI18n();
  const text = value === null || value === undefined ? "" : String(value);
  const options: readonly Choice[] =
    kind === "boolean"
      ? [
          { value: TRUE, label: t("bool.yes") },
          { value: FALSE, label: t("bool.no") },
        ]
      : choices;
  const read = (raw: string): CellValue => {
    if (raw === ANY) return null;
    if (kind === "boolean") return raw === TRUE;
    return kind === "number" ? Number(raw) : raw;
  };

  return (
    <Field label={label}>
      {(id) =>
        kind === "boolean" || kind === "option" ? (
          <Select id={id} value={text} onChange={(event) => onChange(read(event.target.value))}>
            <Option value={ANY}>{t("export.filters.chooseValue")}</Option>
            {options.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        ) : (
          <Input id={id} type={INPUT_TYPE[kind]} value={text} onChange={(event) => onChange(read(event.target.value))} />
        )
      }
    </Field>
  );
}

interface Props {
  rule: FilterSpec;
  fields: readonly FieldDef[];
  /** Every loaded row, for the values a field without a fixed option list really holds. */
  rows: readonly Row[];
  /** In the FLEX relation each filter can be marked as required. */
  showRequired: boolean;
  onChange: (rule: FilterSpec) => void;
  onRemove: () => void;
}

/** One custom filter: how it compares, what it compares with, and whether it is switched on. */
export function FilterCard({ rule, fields, rows, showRequired, onChange, onRemove }: Props) {
  const { t, tData, locale } = useI18n();
  const { format } = useReport();
  const field = fields.find((candidate) => candidate.key === rule.field);
  if (!field) return null;

  const labels = { fields, t, tData };
  const isCompare = rule.compareField !== undefined;
  const title = isCompare ? t("export.filters.compareTitle", { a: fieldLabel(rule.field, labels), b: fieldLabel(rule.compareField ?? "", labels) }) : t(field.labelKey);
  const operator = resolveOperator(rule, field);
  const shape = VALUE_SHAPE[operator];
  const kind = valueKind(rule, field);
  const periods = isCompare ? undefined : PERIODS_BY_TYPE[field.type];

  const optionLabel = (value: string) => {
    if (field.type === "country") return format.country(value);
    return field.optionPrefix ? tData(field.optionPrefix, value) : value;
  };
  const choices: Choice[] =
    kind === "option" ? (field.options ?? distinctValues({ rows, key: field.key, locale })).map((value) => ({ value, label: optionLabel(value) })) : [];

  const setValue = (index: number) => (value: CellValue) => {
    const values = [...rule.values];
    values[index] = value;
    onChange({ ...rule, values });
  };
  const setFieldOperator = (value: string) => {
    if (!isFieldOperator(value) || !rule.compareField) return;
    // A different combination can give a different kind of result, so the test on that result starts over.
    onChange({ ...createCompareRule({ field: rule.field, fieldOperator: value, compareField: rule.compareField }), id: rule.id, enabled: rule.enabled, mandatory: rule.mandatory });
  };

  return (
    <Card>
      <Stack $gap="sm">
        <Stack $row $wrap $justify="space-between" $gap="sm">
          <Text $medium $size="sm">
            {title}
          </Text>
          <Button $icon $variant="ghost" aria-label={t("export.remove", { name: title })} onClick={onRemove}>
            <Trash2 size={ICON_SIZE} aria-hidden />
          </Button>
        </Stack>
        <Stack $row $wrap $gap="md" $align="end">
          {isCompare ? (
            <Field label={t("export.filters.fieldOperator")}>
              {(id) => (
                <Select id={id} value={rule.fieldOperator ?? ""} onChange={(event) => setFieldOperator(event.target.value)}>
                  {FIELD_OPERATORS_BY_TYPE[field.type].map((option) => (
                    <Option key={option} value={option}>
                      {tData(FIELD_OPERATOR_PREFIX, option)}
                    </Option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <Field label={t("export.filters.operator")}>
            {(id) => (
              <Select
                id={id}
                value={operator}
                onChange={(event) => {
                  const next = offeredOperators(rule, field).find((option) => option === event.target.value);
                  if (next) onChange(withOperator({ rule, field, operator: next }));
                }}
              >
                {offeredOperators(rule, field).map((option) => (
                  <Option key={option} value={option}>
                    {tData(OPERATOR_PREFIX, option)}
                  </Option>
                ))}
              </Select>
            )}
          </Field>
          {shape === "range" && periods ? (
            <Field label={t("export.filters.period")}>
              {(id) => (
                <Select
                  id={id}
                  value={rule.period ?? CUSTOM_DATES}
                  onChange={(event) => onChange(withPeriod({ rule, field, period: event.target.value || undefined, now: new Date() }))}
                >
                  <Option value={CUSTOM_DATES}>{t("export.filters.customDates")}</Option>
                  {periods.map((period) => (
                    <Option key={period} value={period}>
                      {tData(PERIOD_PREFIX, period)}
                    </Option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          {shape === "single" ? <ValueInput kind={kind} value={rule.values[0]} label={t("export.filters.value")} choices={choices} onChange={setValue(0)} /> : null}
          {shape === "range" && !rule.period ? (
            <>
              <ValueInput kind={kind} value={rule.values[0]} label={t("export.filters.from")} choices={choices} onChange={setValue(0)} />
              <ValueInput kind={kind} value={rule.values[1]} label={t("export.filters.to")} choices={choices} onChange={setValue(1)} />
            </>
          ) : null}
          {shape === "list" && choices.length === 0 ? (
            <Field label={t("export.filters.list")}>
              {(id) => (
                <Input
                  id={id}
                  value={rule.values.join(LIST_SEPARATOR)}
                  onChange={(event) => onChange({ ...rule, values: event.target.value.split(LIST_SEPARATOR).map((item) => item.trimStart()) })}
                />
              )}
            </Field>
          ) : null}
        </Stack>
        {shape === "list" && choices.length > 0 ? (
          <Stack $row $wrap $gap="md" role="group" aria-label={t("export.filters.value")}>
            {choices.map((choice) => (
              <Checkbox
                key={choice.value}
                checked={rule.values.includes(choice.value)}
                onChange={(on) => onChange({ ...rule, values: toggleItem(rule.values, choice.value, on) })}
              >
                {choice.label}
              </Checkbox>
            ))}
          </Stack>
        ) : null}
        <Stack $row $wrap $gap="lg">
          <Checkbox checked={rule.enabled !== false} onChange={(enabled) => onChange({ ...rule, enabled })}>
            {t("export.filters.enabled")}
          </Checkbox>
          {showRequired ? (
            <Checkbox checked={rule.mandatory === true} onChange={(mandatory) => onChange({ ...rule, mandatory })}>
              {t("export.filters.required")}
            </Checkbox>
          ) : null}
        </Stack>
      </Stack>
    </Card>
  );
}
