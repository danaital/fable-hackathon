"use client";

import { Button, Notice, Text } from "@/components/ui";
import { useReport } from "@/features/report/ReportContext";
import { useI18n } from "@/i18n";
import { getConversion, summarizeCurrency } from "./convert";
import { useCurrencyIfMounted } from "./CurrencyProvider";

/** Report-level currency status: rates loading or failed, amounts left unconverted, or totals blocked by mixed currencies. */
export function CurrencyNotice() {
  const { t } = useI18n();
  const currency = useCurrencyIfMounted();
  const { report, rows, filteredRows } = useReport();
  if (!currency) return null;

  if (currency.status === "loading") {
    return (
      <Notice $tone="info" role="status">
        {t("currency.status.loading")}
      </Notice>
    );
  }
  if (currency.status === "error") {
    return (
      <Notice $tone="danger" role="alert">
        <Text>{t("currency.status.error")}</Text>
        <Button onClick={currency.retry}>{t("currency.retry")}</Button>
      </Notice>
    );
  }

  const money = report.fields.filter((field) => field.type === "currency" && field.currencyKey);
  const missing = rows.filter((row) => money.some((field) => getConversion(row, field.key)?.missingRate)).length;
  if (missing > 0) {
    return (
      <Notice $tone="warning" role="status">
        {t("currency.status.missing", { count: missing })}
      </Notice>
    );
  }

  const mixed = money.map((field) => summarizeCurrency({ rows: filteredRows, field })).find((summary) => summary.status === "mixed");
  if (mixed?.status !== "mixed") return null;
  return (
    <Notice role="status">
      <Text>{t("currency.status.mixed", { count: mixed.currencies.length })}</Text>
    </Notice>
  );
}
