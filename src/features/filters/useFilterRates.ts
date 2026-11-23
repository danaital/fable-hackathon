"use client";

import { useMemo, useState } from "react";
import type { FieldDef, Row } from "@/data/types";
import { useRates, type RatesStatus } from "@/features/currency/rates";
import { resolveRateDate } from "@/features/currency/timing";
import type { FilterRule } from "@/features/report/viewState";
import type { CurrencySettings } from "@/features/settings/schema";
import { filterRateRequests, type FilterRates } from "./currency";

interface UseFilterRatesInput {
  rows: readonly Row[];
  fields: readonly FieldDef[];
  filters: readonly FilterRule[];
  /** The report's effective currency settings: they decide each row's rate date. */
  currency: CurrencySettings;
}

export interface FilterRatesState {
  /** Pass to `applyFilters` as `rates`. `null` until every needed rate has arrived. */
  rates: FilterRates | null;
  status: RatesStatus;
  retry: () => void;
}

/** Fetches the exchange rates that amount filters typed in their own currency need. No such filter, no request. */
export function useFilterRates({ rows, fields, filters, currency }: UseFilterRatesInput): FilterRatesState {
  const [now] = useState(() => new Date());
  const requests = useMemo(() => filterRateRequests({ rows, fields, filters, currency, now }), [rows, fields, filters, currency, now]);
  const { rates: table, status, retry } = useRates(requests);
  const rates = useMemo<FilterRates | null>(
    () => (status === "ready" ? { table, dateFor: (row) => resolveRateDate({ currency, row, now }) } : null),
    [status, table, currency, now],
  );
  return { rates, status, retry };
}
