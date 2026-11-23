"use client";

import { Stack, Text } from "@/components/ui";
import { useReport } from "@/features/report/ReportContext";
import { ChoiceField } from "@/features/settings/fields";
import { CURRENCY_CHOICES, RATE_TIME_PERIODS, SOURCE_CURRENCY, type RateTimePeriod } from "@/features/settings/schema";
import { saveReportSettings, useEffectiveSettings, useReportSettings, userSettingsStore } from "@/features/settings/store";
import { useI18n } from "@/i18n";
import { useCurrencyLabel } from "./CurrencyFields";

// A custom period needs a date, which lives in the report settings drawer.
const QUICK_PERIODS = RATE_TIME_PERIODS.filter((period): period is Exclude<RateTimePeriod, "custom"> => period !== "custom");

/** Toolbar control for this report's display currency and rate period. Saves the report override at once. */
export function CurrencyControl() {
  const { t } = useI18n();
  const { report } = useReport();
  const currencyLabel = useCurrencyLabel();
  const user = userSettingsStore.useValue();
  const overrides = useReportSettings(report.id);
  const { currency } = useEffectiveSettings(report.id);
  const own = overrides.currency ?? {};
  const save = (patch: typeof own) => saveReportSettings(report.id, { ...overrides, currency: { ...own, ...patch } });

  const converts = currency.selectedCurrency !== SOURCE_CURRENCY && currency.displayMode !== "static";
  const quickPeriod = currency.exchangeRateTiming === "timePeriod" && currency.currencyTimePeriod !== "custom";
  const userQuick = user.currency.exchangeRateTiming === "timePeriod" && user.currency.currencyTimePeriod !== "custom";
  const timingLabel = currency.displayMode === "staticConverted" ? t("currency.mode.staticConverted") : t(`currency.timing.${currency.exchangeRateTiming}`);

  return (
    <Stack $row $wrap $gap="sm" $align="end">
      <ChoiceField
        label={t("currency.target")}
        value={own.selectedCurrency}
        options={CURRENCY_CHOICES}
        optionLabel={currencyLabel}
        inherited={user.currency.selectedCurrency}
        onChange={(selectedCurrency) => save({ selectedCurrency })}
      />
      {converts && quickPeriod && currency.displayMode !== "staticConverted" ? (
        <ChoiceField
          label={t("currency.period")}
          value={own.exchangeRateTiming === "timePeriod" ? own.currencyTimePeriod : undefined}
          options={QUICK_PERIODS}
          optionLabel={(period) => t(`currency.period.${period}`)}
          inherited={userQuick ? user.currency.currencyTimePeriod : undefined}
          inheritLabel={userQuick ? undefined : t("currency.inherit", { value: t(`currency.timing.${user.currency.exchangeRateTiming}`) })}
          onChange={(period) => save({ exchangeRateTiming: period ? "timePeriod" : undefined, currencyTimePeriod: period })}
        />
      ) : null}
      {converts && (!quickPeriod || currency.displayMode === "staticConverted") ? (
        <Text $muted $size="sm">
          {timingLabel}
        </Text>
      ) : null}
    </Stack>
  );
}
