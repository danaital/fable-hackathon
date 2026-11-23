"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Field, Input, Select, Stack } from "@/components/ui";
import type { CellValue, FieldDef } from "@/data/types";
import { useReport } from "@/features/report/ReportContext";
import { DISPLAY_CURRENCIES } from "@/features/settings/schema";
import { useI18n, type I18nKey } from "@/i18n";
import { MultiSelect } from "./MultiSelect";
import { isCompareRule, resolveOperator, resultType, VALUE_SHAPE, valueKind, type FilterSpec, type ValueKind } from "./operators";
import { DebouncedInput, OptGroup, Option, Pair } from "./parts";
import { CUSTOM_PERIOD, DATE_PERIODS, HOUR_PERIODS, isTimePeriod, periodBounds } from "./periods";
import { distinctValues, withPeriod } from "./rules";
import { useFilterText } from "./useFilterText";
import { toBool } from "./values";

const YES = "true";
const NO = "false";
const DATE_LENGTH = 10;
const DATE_TIME_LENGTH = 19;
const MONEY_STEP = "0.01";
const SLOT_LABELS: Record<"single" | "range", readonly I18nKey[]> = {
  single: ["filters.value"],
  range: ["filters.from", "filters.to"],
};

interface EditorProps {
  rule: FilterSpec;
  field: FieldDef;
  onChange: (rule: FilterSpec) => void;
}

interface SlotProps {
  id: string;
  value: CellValue | undefined;
  field: FieldDef;
  readOnly?: boolean;
  onChange: (value: CellValue) => void;
}

const sameNumber = (draft: string, value: string) => draft === value || (draft !== "" && value !== "" && Number(draft) === Number(value));
const asText = (value: CellValue | undefined) => (value === null || value === undefined ? "" : String(value));

function TextSlot({ id, value, onChange }: SlotProps) {
  return <DebouncedInput id={id} type="text" dir="auto" value={asText(value)} onCommit={onChange} />;
}

function NumberSlot({ id, value, field, onChange }: SlotProps) {
  return (
    <DebouncedInput
      id={id}
      type="number"
      inputMode="decimal"
      step={field.type === "currency" ? MONEY_STEP : "any"}
      value={asText(value)}
      isSame={sameNumber}
      onCommit={(text) => onChange(text === "" ? null : Number(text))}
    />
  );
}

function YesNoSlot({ id, value, onChange, required }: SlotProps & { required?: boolean }) {
  const { t } = useI18n();
  const current = toBool(value);
  return (
    <Select id={id} value={current === null ? "" : String(current)} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value === YES)}>
      {required ? null : <Option value="">{t("filters.any")}</Option>}
      <Option value={YES}>{t("bool.yes")}</Option>
      <Option value={NO}>{t("bool.no")}</Option>
    </Select>
  );
}

function useOptions(field: FieldDef) {
  const { locale } = useI18n();
  const { rows } = useReport();
  const { optionLabel } = useFilterText();
  return useMemo(() => {
    // Enum and status fields carry their own options; anything else lists the values its rows really hold.
    const values = field.options ?? distinctValues({ rows, key: field.key, locale });
    return values.map((value) => ({ value, label: optionLabel(field, value) }));
  }, [field, rows, locale, optionLabel]);
}

function OptionSlot({ id, value, field, onChange }: SlotProps) {
  const { t } = useI18n();
  const options = useOptions(field);
  return (
    <Select id={id} value={asText(value)} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}>
      <Option value="">{t("filters.any")}</Option>
      {options.map((option) => (
        <Option key={option.value} value={option.value}>
          {option.label}
        </Option>
      ))}
    </Select>
  );
}

function DateSlot({ id, value, field, readOnly, onChange }: SlotProps) {
  const withTime = field.type === "datetime";
  return (
    <Input
      id={id}
      type={withTime ? "datetime-local" : "date"}
      value={asText(value).slice(0, withTime ? DATE_TIME_LENGTH : DATE_LENGTH)}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
    />
  );
}

const SLOTS: Record<ValueKind, (props: SlotProps) => ReactNode> = {
  text: TextSlot,
  number: NumberSlot,
  boolean: YesNoSlot,
  option: OptionSlot,
  date: DateSlot,
  datetime: DateSlot,
};

function ListEditor({ rule, field, onChange }: EditorProps) {
  const { t } = useI18n();
  const options = useOptions(field);
  const selected = rule.values.filter((value) => value !== null).map(String);
  // Values already chosen stay in the list even when no loaded row holds them any more.
  const known = new Set(options.map((option) => option.value));
  const all = [...options, ...selected.filter((value) => !known.has(value)).map((value) => ({ value, label: value }))];
  return <MultiSelect label={t("filters.value")} options={all} selected={selected} onChange={(values) => onChange({ ...rule, values })} />;
}

function PeriodSelect({ rule, field, onChange, now }: EditorProps & { now: Date }) {
  const { t } = useI18n();
  const setPeriod = (value: string) => onChange(withPeriod({ rule, field, period: value === CUSTOM_PERIOD ? undefined : value, now }));
  return (
    <Field label={t("filters.period")} hint={t("filters.period.hint")}>
      {(id) => (
        <Select id={id} value={isTimePeriod(rule.period) ? rule.period : CUSTOM_PERIOD} onChange={(event) => setPeriod(event.target.value)}>
          <Option value={CUSTOM_PERIOD}>{t("filters.period.custom")}</Option>
          <OptGroup label={t("filters.period.group.dates")}>
            {DATE_PERIODS.map((period) => (
              <Option key={period} value={period}>
                {t(`filters.period.${period}`)}
              </Option>
            ))}
          </OptGroup>
          {field.type === "datetime" ? (
            <OptGroup label={t("filters.period.group.hours")}>
              {HOUR_PERIODS.map((period) => (
                <Option key={period} value={period}>
                  {t(`filters.period.${period}`)}
                </Option>
              ))}
            </OptGroup>
          ) : null}
        </Select>
      )}
    </Field>
  );
}

function CurrencySelect({ rule, onChange }: EditorProps) {
  const { t } = useI18n();
  return (
    <Field label={t("filters.currency")}>
      {(id) => (
        <Select
          id={id}
          value={rule.currency?.targetCurrency ?? ""}
          onChange={(event) => onChange({ ...rule, currency: event.target.value ? { targetCurrency: event.target.value } : undefined })}
        >
          <Option value="">{t("filters.currency.shown")}</Option>
          {DISPLAY_CURRENCIES.map((code) => (
            <Option key={code} value={code}>
              {code}
            </Option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** The value part of a filter card: which controls show depends on the operator and on what is being compared. */
export function ValueEditor({ rule, field, onChange }: EditorProps) {
  const { t } = useI18n();
  // Read the clock once per card, so a preset period shows steady dates while the card is open.
  const [now] = useState(() => new Date());
  const operator = resolveOperator(rule, field);
  const shape = VALUE_SHAPE[operator];
  const compare = isCompareRule(rule);
  const kind = valueKind(rule, field);

  if (shape === "null") {
    return (
      <Field label={t(`filters.op.${operator}`)}>
        {(id) => <YesNoSlot id={id} field={field} value={rule.values[0] ?? true} required onChange={(value) => onChange({ ...rule, values: [value] })} />}
      </Field>
    );
  }
  if (shape === "list") return <ListEditor rule={rule} field={field} onChange={onChange} />;

  const dated = field.type === "date" || field.type === "datetime";
  const temporal = dated && !compare;
  const bounds = temporal && shape === "range" ? periodBounds({ period: rule.period, fieldType: field.type, now }) : null;
  const values = bounds ?? rule.values;
  const Slot = SLOTS[kind];
  const setAt = (index: number) => (value: CellValue) => {
    const next: CellValue[] = shape === "range" ? [values[0] ?? null, values[1] ?? null] : [null];
    next[index] = value;
    onChange({ ...rule, values: next, period: undefined });
  };
  const hint = field.type === "percent" && !compare ? t("filters.percentHint") : undefined;
  const resultHint = resultType(rule) === "number" && dated ? t("filters.daysHint") : undefined;

  return (
    <Stack $gap="sm">
      {temporal ? <PeriodSelect rule={rule} field={field} onChange={onChange} now={now} /> : null}
      <Pair>
        {SLOT_LABELS[shape].map((labelKey, index) => (
          <Field key={labelKey} label={t(compare && shape === "single" ? "filters.result.value" : labelKey)} hint={hint ?? resultHint}>
            {(id) => <Slot id={id} field={field} value={values[index]} readOnly={bounds !== null} onChange={setAt(index)} />}
          </Field>
        ))}
      </Pair>
      {field.type === "currency" && !compare ? <CurrencySelect rule={rule} field={field} onChange={onChange} /> : null}
    </Stack>
  );
}
