"use client";

import { useMemo } from "react";
import { z } from "zod";
import { BUILT_IN_SUMMARY, FALLBACK_WIDGET } from "@/data/summary";
import { createLocalStore } from "@/lib/store";
import { summaryConfigSchema, type SummaryConfig } from "./config";

export const SUMMARY_CONFIG_KEY = "bahir_summary_config";

type Overrides = Record<string, unknown>;
const EMPTY: SummaryConfig = { widgets: [], charts: [] };
const overrideSchema = summaryConfigSchema.partial();

/**
 * Per-report overrides of the built-in summary config: `{ [reportId]: { widgets?, charts? } }`.
 * Write imported JSON here through this store (not straight to localStorage), so open pages update at once.
 * Each report's entry is validated on read, so one bad entry cannot break the other reports.
 */
export const summaryConfigStore = createLocalStore<Overrides>(SUMMARY_CONFIG_KEY, z.record(z.string(), z.unknown()), {});

/**
 * The built-in config with the report's override merged in: a list the override carries replaces the built-in list,
 * a list it leaves out stays. An invalid override is ignored. A report left with no widgets gets the row-count card.
 */
export function resolveSummaryConfig(reportId: string, overrides: Overrides): SummaryConfig {
  const builtIn = BUILT_IN_SUMMARY[reportId] ?? EMPTY;
  const override = overrideSchema.safeParse(overrides[reportId]);
  const widgets = (override.success ? override.data.widgets : undefined) ?? builtIn.widgets;
  const charts = (override.success ? override.data.charts : undefined) ?? builtIn.charts;
  return { widgets: widgets.length === 0 ? [FALLBACK_WIDGET] : widgets, charts };
}

export function getSummaryConfig(reportId: string): SummaryConfig {
  return resolveSummaryConfig(reportId, summaryConfigStore.read());
}

export function useSummaryConfig(reportId: string): SummaryConfig {
  const overrides = summaryConfigStore.useValue();
  return useMemo(() => resolveSummaryConfig(reportId, overrides), [reportId, overrides]);
}
