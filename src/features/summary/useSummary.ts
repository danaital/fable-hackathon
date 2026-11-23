"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { FieldDef, FieldType } from "@/data/types";
import { useReport } from "@/features/report/ReportContext";
import type { FilterRule, ViewState } from "@/features/report/viewState";
import { useI18n } from "@/i18n";
import { OTHER_KEY, type LabelFor } from "./chartData";
import type { ConfigFilter, DrillConfig, LocalizedText } from "./config";
import type { Measure, Rows, Unit } from "./values";

const ISO_MONTH_LENGTH = 7;
const ISO_DAY_LENGTH = 10;
/** The table sits right after the widget grid; exploring a card scrolls to this anchor and moves focus there. */
export const TABLE_ANCHOR_ID = "summary-table-anchor";

/** Shows only the ids a view lists. `null` shows all, an empty list shows none; ids the report lacks are ignored. */
export function visibleItems<T extends { id: string }>(items: readonly T[], shown: readonly string[] | null): T[] {
  return shown === null ? [...items] : items.filter((item) => shown.includes(item.id));
}

interface LabelContext {
  field: FieldDef;
  format: ReturnType<typeof useReport>["format"];
  tData: ReturnType<typeof useI18n>["tData"];
  yesNo: (value: boolean) => string;
  month: (isoMonth: string) => string;
}

const LABELERS: Partial<Record<FieldType, (key: string, context: LabelContext) => string>> = {
  enum: (key, { field, tData }) => (field.optionPrefix ? tData(field.optionPrefix, key) : key),
  status: (key, { field, tData }) => (field.optionPrefix ? tData(field.optionPrefix, key) : key),
  country: (key, { format }) => format.country(key),
  boolean: (key, { yesNo }) => yesNo(key === "true"),
  number: (key, { format }) => format.number(Number(key)),
  percent: (key, { format }) => format.percent(Number(key)),
  // A date category is a day, a month or a year bucket, told apart by its length.
  date: (key, context) => dateLabel(key, context),
  datetime: (key, context) => dateLabel(key, context),
};

function dateLabel(key: string, { format, month }: LabelContext): string {
  if (key.length >= ISO_DAY_LENGTH) return format.date(key);
  return key.length === ISO_MONTH_LENGTH ? month(key) : key;
}

/** Text, labels and number formatting for summary cards, in the current language. */
export function useSummaryTools() {
  const { t, tData, locale } = useI18n();
  const { report, format } = useReport();

  return useMemo(() => {
    const fields = new Map(report.fields.map((field) => [field.key, field]));
    const monthFormat = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" });
    const context = {
      format,
      tData,
      yesNo: (value: boolean) => t(value ? "bool.yes" : "bool.no"),
      month: (isoMonth: string) => monthFormat.format(new Date(`${isoMonth}-01T00:00:00Z`)),
    };
    const labelFor: LabelFor = (key, fieldKey) => {
      if (key === OTHER_KEY) return t("summary.other");
      const field = fields.get(fieldKey);
      return field ? (LABELERS[field.type]?.(key, { ...context, field }) ?? key) : key;
    };
    const formatters: Record<Unit["type"], (value: number, unit: Unit) => string> = {
      number: (value) => format.number(value),
      percent: (value) => format.percent(value),
      currency: (value, unit) => format.currency(value, unit.currency),
    };
    return {
      text: (value: LocalizedText) => value[locale],
      labelFor,
      formatMeasure: ({ value, unit }: Measure) => formatters[unit.type](value, unit),
      fieldLabel: (key: string) => {
        const field = fields.get(key);
        return field ? t(field.labelKey) : key;
      },
    };
  }, [t, tData, locale, report.fields, format]);
}

export type SummaryTools = ReturnType<typeof useSummaryTools>;

export interface SummaryRows {
  /** Rows after the view's filters and search. */
  filtered: Rows;
  /** Every loaded row, for items that ignore the active filters. */
  all: Rows;
}

/**
 * The rows cards calculate from, one render behind the page: the page paints first (skeletons on the first
 * render, the previous values after that) and the calculation follows. `rows` is null until the first pass.
 */
export function useSummaryRows(): { rows: SummaryRows | null; busy: boolean; now: Date } {
  const { rows: all, filteredRows: filtered } = useReport();
  const current = useMemo<SummaryRows>(() => ({ filtered, all }), [filtered, all]);
  const rows = useDeferredValue<SummaryRows | null>(current, null);
  // One "now" per page visit, so every comparison on the page uses the same day.
  const [now] = useState(() => new Date());
  return { rows, busy: rows !== current, now };
}

const isValueRule = (rule: FilterRule) => rule.compareField === undefined;

/**
 * Adds a card's filters to the current view and brings the table into view. Existing filters stay; a filter
 * the user already has on the same field is replaced, as with filters that arrive from a link.
 */
export function useExplore(): { explore: (input: ExploreInput) => void; announcement: string } {
  const { t } = useI18n();
  const { setView } = useReport();
  const [announcement, setAnnouncement] = useState("");

  const explore = ({ id, title, drill, extraFilters = [] }: ExploreInput) => {
    const added: FilterRule[] = [...drill.filters, ...extraFilters]
      .filter((filter) => filter.values.length > 0)
      .map(({ field, operator, values }) => ({ id: `summary:${id}:${field}`, field, operator, values }));
    const fields = new Set(added.map((rule) => rule.field));
    setView((current: ViewState) => ({
      ...current,
      filters: [...current.filters.filter((rule) => rule.mandatory || !isValueRule(rule) || !fields.has(rule.field)), ...added],
      groupBy: drill.groupBy ?? current.groupBy,
      sorts: drill.sorts ?? current.sorts,
    }));
    setAnnouncement(t("summary.card.explored", { title }));
    const anchor = document.getElementById(TABLE_ANCHOR_ID);
    anchor?.scrollIntoView();
    anchor?.focus({ preventScroll: true });
  };

  return { explore, announcement };
}

export interface ExploreInput {
  /** The card's id; makes the added filter ids stable, so exploring twice adds nothing twice. */
  id: string;
  title: string;
  drill: DrillConfig;
  extraFilters?: readonly ConfigFilter[];
}
