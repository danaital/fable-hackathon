"use client";

import { useMemo } from "react";
import { createLocalStore } from "@/lib/store";
import {
  DEFAULT_USER_SETTINGS,
  reportSettingsMapSchema,
  resolveEffective,
  userSettingsSchema,
  type EffectiveSettings,
  type ReportSettings,
  type ReportSettingsMap,
  type UserSettings,
} from "./schema";

// shortcut: settings live in this browser only (see lib/store.ts). Move to per-user rows when login lands.
const EMPTY_REPORT_SETTINGS: ReportSettingsMap = {};
const EMPTY_OVERRIDES: ReportSettings = {};

/**
 * Built-in currency behavior per report, used until the user saves their own settings for that report.
 * Orders and invoices convert each row at its own date (dynamic); shipments convert every row at one pinned date (static).
 */
const PINNED_RATE_DATE = "2026-01-02";
export const BUILT_IN_REPORT_SETTINGS: ReportSettingsMap = {
  orders: { currency: { selectedCurrency: "USD", displayMode: "dynamic", exchangeRateTiming: "dateField", dateFieldForConversion: "orderDate" } },
  invoices: { currency: { selectedCurrency: "EUR", displayMode: "semiConverted", exchangeRateTiming: "dateField", dateFieldForConversion: "issuedOn" } },
  shipments: { currency: { selectedCurrency: "USD", displayMode: "staticConverted", exchangeRateTiming: "custom", customExchangeDate: PINNED_RATE_DATE } },
};

export const userSettingsStore = createLocalStore<UserSettings>("bahir.settings.user", userSettingsSchema, DEFAULT_USER_SETTINGS);
export const reportSettingsStore = createLocalStore<ReportSettingsMap>(
  "bahir.settings.reports",
  reportSettingsMapSchema,
  EMPTY_REPORT_SETTINGS,
);

/** The report's own overrides only (absent members inherit). */
export function useReportSettings(reportId: string): ReportSettings {
  return reportSettingsStore.useValue()[reportId] ?? BUILT_IN_REPORT_SETTINGS[reportId] ?? EMPTY_OVERRIDES;
}

/** Replaces one report's overrides; an empty object means "inherit everything". */
export function saveReportSettings(reportId: string, settings: ReportSettings): void {
  reportSettingsStore.write({ ...reportSettingsStore.read(), [reportId]: settings });
}

/** Settings to render with. Pass a report id to apply that report's overrides on top of the user's settings. */
export function useEffectiveSettings(reportId?: string): EffectiveSettings {
  const user = userSettingsStore.useValue();
  const reports = reportSettingsStore.useValue();
  const report = reportId ? (reports[reportId] ?? BUILT_IN_REPORT_SETTINGS[reportId]) : undefined;
  return useMemo(() => resolveEffective(user, report), [user, report]);
}
