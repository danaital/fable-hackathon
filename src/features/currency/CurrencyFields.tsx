"use client";

import { useMemo } from "react";
import { Field, Input, Notice, Stack, Text } from "@/components/ui";
import type { FieldDef } from "@/data/types";
import { ChoiceField } from "@/features/settings/fields";
import {
  CURRENCY_CHOICES,
  CURRENCY_DISPLAY_MODES,
  RATE_TIMINGS,
  RATE_TIME_PERIODS,
  SOURCE_CURRENCY,
  type CurrencyChoice,
  type CurrencySettings,
  type RateTiming,
} from "@/features/settings/schema";
import { useI18n } from "@/i18n";
import { MIN_RATE_DATE, isoDay } from "./codes";
import { customDateProblem } from "./timing";

const USER_TIMINGS: readonly RateTiming[] = ["timePeriod", "custom"];
const DATE_TYPES: ReadonlySet<FieldDef["type"]> = new Set(["date", "datetime"]);
const PROBLEM_KEY = { required: "currency.customDate.required", range: "currency.customDate.range" } as const;

export interface CurrencyFieldsProps {
  /** The layer being edited: full user settings, or a report's partial overrides. */
  value: Partial<CurrencySettings>;
  /** What applies after inheritance (equal to `value` at user level). */
  effective: CurrencySettings;
  /** Report level: the user's values, offered as the "use my settings" choice. */
  inherited?: CurrencySettings;
  /** Report level: the report's fields, which enables timing by a date in each row. */
  fields?: readonly FieldDef[];
  onChange: (patch: Partial<CurrencySettings>) => void;
}

/** Label for a display-currency choice: the localized currency name and its code, or "each row's own currency". */
export function useCurrencyLabel(): (choice: CurrencyChoice) => string {
  const { t, locale } = useI18n();
  const names = useMemo(() => new Intl.DisplayNames([locale], { type: "currency" }), [locale]);
  return (choice) => (choice === SOURCE_CURRENCY ? t("currency.target.row") : `${names.of(choice) ?? choice} (${choice})`);
}

/** Display currency, display mode and exchange-rate timing. Controls that cannot apply are hidden. */
export function CurrencyFields({ value, effective, inherited, fields, onChange }: CurrencyFieldsProps) {
  const { t } = useI18n();
  const currencyLabel = useCurrencyLabel();
  const dateFields = (fields ?? []).filter((field) => DATE_TYPES.has(field.type));
  const timings = fields ? RATE_TIMINGS : USER_TIMINGS;
  const problem = customDateProblem({ currency: effective, now: new Date() });

  const converts = effective.selectedCurrency !== SOURCE_CURRENCY && effective.displayMode !== "static";
  const pinned = effective.displayMode === "staticConverted";
  const showDate = pinned || effective.exchangeRateTiming === "custom" || (effective.exchangeRateTiming === "timePeriod" && effective.currencyTimePeriod === "custom");

  const setTiming = (timing: RateTiming | undefined) =>
    onChange({
      exchangeRateTiming: timing,
      // Timing by row date needs a field; start with the first one.
      ...(timing === "dateField" && !value.dateFieldForConversion ? { dateFieldForConversion: dateFields[0]?.key ?? null } : {}),
    });

  return (
    <Stack $gap="md">
      <ChoiceField
        label={t("currency.target")}
        value={value.selectedCurrency}
        options={CURRENCY_CHOICES}
        optionLabel={currencyLabel}
        inherited={inherited?.selectedCurrency}
        onChange={(selectedCurrency) => onChange({ selectedCurrency })}
      />
      {effective.selectedCurrency !== SOURCE_CURRENCY ? (
        <ChoiceField
          label={t("currency.mode")}
          value={value.displayMode}
          options={CURRENCY_DISPLAY_MODES}
          optionLabel={(mode) => t(`currency.mode.${mode}`)}
          inherited={inherited?.displayMode}
          onChange={(displayMode) => onChange({ displayMode })}
        />
      ) : null}
      {converts && !pinned ? (
        <ChoiceField
          label={t("currency.timing")}
          value={value.exchangeRateTiming}
          options={timings}
          optionLabel={(timing) => t(`currency.timing.${timing}`)}
          inherited={inherited?.exchangeRateTiming}
          onChange={setTiming}
        />
      ) : null}
      {converts && !pinned && effective.exchangeRateTiming === "timePeriod" ? (
        <ChoiceField
          label={t("currency.period")}
          value={value.currencyTimePeriod}
          options={RATE_TIME_PERIODS}
          optionLabel={(period) => t(`currency.period.${period}`)}
          inherited={inherited?.currencyTimePeriod}
          onChange={(currencyTimePeriod) => onChange({ currencyTimePeriod })}
        />
      ) : null}
      {converts && !pinned && effective.exchangeRateTiming === "dateField" ? (
        <DateFieldChoice fields={dateFields} value={value.dateFieldForConversion ?? undefined} onChange={(key) => onChange({ dateFieldForConversion: key ?? null })} />
      ) : null}
      {converts && showDate ? (
        <Field
          label={t(pinned ? "currency.fixedDate" : "currency.customDate")}
          hint={inherited?.customExchangeDate ? t("currency.inherited", { value: inherited.customExchangeDate }) : undefined}
          error={problem ? t(PROBLEM_KEY[problem], { min: MIN_RATE_DATE }) : undefined}
        >
          {(id) => (
            <Input
              id={id}
              type="date"
              min={MIN_RATE_DATE}
              max={isoDay(new Date())}
              value={value.customExchangeDate ?? ""}
              aria-invalid={problem ? true : undefined}
              // Empty clears a report override (inherit) or leaves the user's date unset (flagged as required).
              onChange={(event) => onChange({ customExchangeDate: event.target.value || (inherited ? undefined : null) })}
            />
          )}
        </Field>
      ) : null}
      {converts ? (
        <Text $muted $size="xs">
          {t("currency.rateNote")}
        </Text>
      ) : null}
    </Stack>
  );
}

interface DateFieldChoiceProps {
  fields: readonly FieldDef[];
  value: string | undefined;
  onChange: (key: string | undefined) => void;
}

function DateFieldChoice({ fields, value, onChange }: DateFieldChoiceProps) {
  const { t } = useI18n();
  if (fields.length === 0) {
    return (
      <Notice $tone="warning" role="status">
        {t("currency.dateField.none")}
      </Notice>
    );
  }
  const labels = new Map(fields.map((field) => [field.key, t(field.labelKey)]));
  return (
    <ChoiceField
      label={t("currency.dateField")}
      value={value}
      options={fields.map((field) => field.key)}
      optionLabel={(key) => labels.get(key) ?? key}
      onChange={onChange}
    />
  );
}
