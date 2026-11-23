"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { ReportDef, Row } from "@/data/types";
import type { CurrencySettings } from "@/features/settings/schema";
import { useEffectiveSettings } from "@/features/settings/store";
import { convertAmount, rateRequestsFor, targetCurrency, type AmountConversion, type RateTable } from "./convert";
import { useRates, type RatesStatus } from "./rates";
import { resolveRateDate } from "./timing";

export interface ConvertInput {
  amount: number;
  from: string;
  /** The row the amount belongs to; its date decides the rate under date-field timing. */
  row: Row;
}

export interface CurrencyValue {
  /** Effective currency settings for this report (report override, then user, then defaults). */
  settings: CurrencySettings;
  /** Code amounts are shown in, or null when every row keeps its own currency. */
  target: string | null;
  status: RatesStatus;
  /** True while rates the report's rows need are still loading. */
  isConverting: boolean;
  rates: RateTable;
  retry: () => void;
  /** Converts one amount to the target. Never throws; a missing rate returns the original, flagged. */
  convert: (input: ConvertInput) => AmountConversion;
}

const CurrencyContext = createContext<CurrencyValue | null>(null);

/** Loads the exchange rates a report's rows need and shares them, with the effective settings, below it. */
export function CurrencyProvider({ report, rows, children }: { report: ReportDef; rows: readonly Row[]; children: ReactNode }) {
  const { currency } = useEffectiveSettings(report.id);
  const requests = useMemo(() => rateRequestsFor({ rows, fields: report.fields, currency }), [rows, report.fields, currency]);
  const { rates, status, retry } = useRates(requests);
  const target = targetCurrency(currency);

  const convert = useCallback(
    ({ amount, from, row }: ConvertInput) =>
      convertAmount({ amount, from, to: target ?? from, rateDate: resolveRateDate({ currency, row, now: new Date() }), rates }),
    [currency, target, rates],
  );

  const value = useMemo<CurrencyValue>(
    () => ({ settings: currency, target, status, isConverting: status === "loading", rates, retry, convert }),
    [currency, target, status, rates, retry, convert],
  );
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyValue {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error("useCurrency must be used inside CurrencyProvider");
  return value;
}

/** For slots that may render before the provider is mounted. */
export function useCurrencyIfMounted(): CurrencyValue | null {
  return useContext(CurrencyContext);
}
