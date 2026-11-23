"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ReportDef, Row } from "@/data/types";
import { convertRows } from "@/features/currency/convert";
import { useCurrency } from "@/features/currency/CurrencyProvider";
import { applyFilters } from "@/features/filters/engine";
import { useFilterRates } from "@/features/filters/useFilterRates";
import { cellText } from "@/features/grid/cells";
import { useEffectiveSettings } from "@/features/settings/store";
import { useI18n } from "@/i18n";
import { createFormatters, type Formatters } from "@/lib/format";
import { defaultViewState, type ViewState } from "./viewState";

type ViewUpdate = Partial<ViewState> | ((current: ViewState) => ViewState);

interface ReportContextValue {
  report: ReportDef;
  /** Translated report title. */
  name: string;
  /** Every loaded row, before any filtering. */
  rows: readonly Row[];
  /** Rows after filters and search, unsorted. The grid, widgets, charts and export all start here. */
  filteredRows: readonly Row[];
  view: ViewState;
  /** Merge a partial change, or pass a function for changes based on the current view. */
  setView: (update: ViewUpdate) => void;
  /** Back to the report's built-in default view. */
  resetView: () => void;
  format: Formatters;
}

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({ report, rows, children }: { report: ReportDef; rows: readonly Row[]; children: ReactNode }) {
  const { t, tData, locale } = useI18n();
  const [view, setViewState] = useState<ViewState>(() => defaultViewState(report));
  const settings = useEffectiveSettings(report.id);
  const format = useMemo(() => createFormatters(locale, settings.formatting), [locale, settings.formatting]);
  // Amounts are converted once, up front, so every consumer of the rows sees the display currency.
  const { rates } = useCurrency();
  const displayRows = useMemo(
    () => convertRows({ rows, fields: report.fields, currency: settings.currency, rates }),
    [rows, report.fields, settings.currency, rates],
  );

  const setView = useCallback((update: ViewUpdate) => {
    setViewState((current) => (typeof update === "function" ? update(current) : { ...current, ...update }));
  }, []);
  const resetView = useCallback(() => setViewState(defaultViewState(report)), [report]);

  // Rates for amount filters typed in their own currency ("amount > 100 EUR"); null while they load.
  const { rates: filterRates } = useFilterRates({ rows: displayRows, fields: report.fields, filters: view.filters, currency: settings.currency });

  const filteredRows = useMemo(() => {
    const filtered = applyFilters({
      rows: displayRows,
      filters: view.filters,
      relation: view.relation,
      fields: report.fields,
      rates: filterRates,
    });
    const term = view.search.trim().toLowerCase();
    if (!term) return filtered;
    const searchable = report.fields.filter((field) => view.columns.includes(field.key));
    return filtered.filter((row) =>
      searchable.some((field) => cellText(row[field.key], { field, row, format, t, tData }).toLowerCase().includes(term)),
    );
  }, [displayRows, view.filters, view.relation, view.search, view.columns, report.fields, filterRates, format, t, tData]);

  const value = useMemo<ReportContextValue>(
    () => ({ report, name: t(report.titleKey), rows: displayRows, filteredRows, view, setView, resetView, format }),
    [report, t, displayRows, filteredRows, view, setView, resetView, format],
  );

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReport(): ReportContextValue {
  const value = useContext(ReportContext);
  if (!value) throw new Error("useReport must be used inside ReportProvider");
  return value;
}
