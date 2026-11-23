import type { FieldDef, ReportDef, Row } from "@/data/types";
import { applyFilters } from "@/features/filters/engine";
import { anchorKeys } from "@/features/grid/columns";
import { sortRows, type SortRule } from "@/features/grid/sort";
import type { Aggregate, FilterRelation, FilterRule, ViewState } from "@/features/report/viewState";
import { createFormatters } from "@/lib/format";
import { DIRECTION, type Locale } from "@/lib/prefs";
import type { CellEnv } from "./cells";
import type { ChartRow, ExportChart } from "./chartSource";
import { describeFilter, describeSort } from "./describe";
import { defaultFileName, sanitizeFileName, uniqueHeaders } from "./safety";
import type { Definition, SavedView } from "./savedViews";
import type { CsvDelimiter, DataSource, ExportFormat, ExportTemplate, FileDesign, OutputMode, WizardState } from "./schema";
import { translatorFor, type Translate } from "./translate";

/** Everything the export reads from the page it was opened on. */
export interface PageContext {
  report: ReportDef;
  rows: readonly Row[];
  filteredRows: readonly Row[];
  view: ViewState;
  savedViews: readonly SavedView[];
  currentViewId: string | null;
  templates: readonly ExportTemplate[];
  charts: readonly ExportChart[];
  uiLocale: Locale;
}

export interface ExportColumn {
  field: FieldDef;
  header: string;
}

export interface MetaLine {
  label: string;
  value: string;
  heading?: boolean;
}

export interface PlanSummary {
  label: string;
  fields: { field: FieldDef; calc: Aggregate }[];
}

export interface PlanGrouping {
  fields: FieldDef[];
  innerSummary: boolean;
  outputMode: OutputMode;
  includeGrandTotal: boolean;
}

/** The resolved export: what the generators turn into a file. Nothing in it still depends on the wizard. */
export interface ExportPlan {
  format: ExportFormat;
  fileName: string;
  title: string;
  locale: Locale;
  rtl: boolean;
  columns: ExportColumn[];
  rows: Row[];
  env: CellEnv;
  t: Translate;
  summary: PlanSummary | null;
  grouping: PlanGrouping | null;
  charts: { title: string; rows: ChartRow[] }[];
  metadata: MetaLine[] | null;
  design: FileDesign;
  csvDelimiter: CsvDelimiter;
}

export interface ResolvedRules {
  filters: readonly FilterRule[];
  relation: FilterRelation;
  /** True when the filters are the page's own, so the page's filtered rows can be used as they are. */
  liveFilters: boolean;
  sorts: readonly SortRule[];
}

export const templateDefinition = ({ name, filters, filterRelation, sorts, columns }: ExportTemplate): Definition => ({
  name,
  filters,
  relation: filterRelation,
  sorts,
  columns,
});

const DEFINITION: Record<DataSource, (state: WizardState, page: PageContext) => Definition | undefined> = {
  current: () => undefined,
  custom: () => undefined,
  current_by_definition: (_state, page) => page.savedViews.find((view) => view.id === page.currentViewId),
  other_view: (state, page) => page.savedViews.find((view) => view.id === state.otherViewId),
  template: (state, page) => {
    const template = page.templates.find((candidate) => candidate.id === state.templateId);
    return template && templateDefinition(template);
  },
};

/** The saved view or template the data source points at. "Current view" and "custom" have none. */
export function sourceDefinition(state: WizardState, page: PageContext): Definition | undefined {
  return DEFINITION[state.source](state, page);
}

/** Filters and sorts by their chosen source: the view or template, the live page, or the wizard's own lists. */
export function resolveRules(state: WizardState, page: PageContext): ResolvedRules {
  const definition = sourceDefinition(state, page);
  const fromDefinition = (source: WizardState["filtersSource"]) => (source === "from_view" ? definition : undefined);

  const filterDefinition = fromDefinition(state.filtersSource);
  let filters: Pick<ResolvedRules, "filters" | "relation" | "liveFilters"> = {
    filters: page.view.filters,
    relation: page.view.relation,
    liveFilters: true,
  };
  if (state.filtersSource === "custom") filters = { filters: state.customFilters, relation: state.filterRelation, liveFilters: false };
  else if (filterDefinition) filters = { filters: filterDefinition.filters, relation: filterDefinition.relation, liveFilters: false };

  let sorts: readonly SortRule[] = fromDefinition(state.sortsSource)?.sorts ?? page.view.sorts;
  if (state.sortsSource === "custom") sorts = state.customSorts;
  return { ...filters, sorts };
}

const fieldsByKey = (report: ReportDef, keys: readonly string[]): FieldDef[] =>
  keys.flatMap((key) => report.fields.find((field) => field.key === key) ?? []);

/**
 * Columns of the file. "Custom" and "template" use the wizard's own list (anchor columns always included),
 * a saved view brings its own columns, and everything else is what the page shows.
 */
export function resolveColumns(state: WizardState, page: PageContext): FieldDef[] {
  const { report } = page;
  const usesOwnList = state.source === "custom" || state.source === "template";
  const keys = usesOwnList ? state.selectedFields : (sourceDefinition(state, page)?.columns ?? []);
  const anchors = state.source === "custom" ? anchorKeys(report.fields).filter((key) => !keys.includes(key)) : [];
  const chosen = fieldsByKey(report, [...anchors, ...keys]);
  if (chosen.length > 0) return chosen;
  const visible = fieldsByKey(report, page.view.columns);
  return visible.length > 0 ? visible : [...report.fields];
}

export function resolveGrouping(state: WizardState, report: ReportDef): PlanGrouping | null {
  const { enabled, groupBy, innerSummary, outputMode, includeGrandTotal } = state.grouping;
  const fields = fieldsByKey(report, groupBy);
  if (state.format !== "xlsx" || !enabled || fields.length === 0) return null;
  return { fields, innerSummary, outputMode, includeGrandTotal };
}

interface RowsInput {
  page: PageContext;
  rules: ResolvedRules;
  grouping: PlanGrouping | null;
  now: Date;
}

/** Filter, then sort. With grouping the group fields sort first, so each group's rows sit together. */
export function resolveRows({ page, rules, grouping, now }: RowsInput): Row[] {
  const { report } = page;
  const filtered = rules.liveFilters
    ? page.filteredRows
    : applyFilters({ rows: page.rows, filters: rules.filters, relation: rules.relation, fields: report.fields, now });
  const groupKeys = new Set(grouping?.fields.map((field) => field.key));
  const groupSorts: SortRule[] = (grouping?.fields ?? []).map((field) => ({
    key: field.key,
    direction: rules.sorts.find((rule) => rule.key === field.key)?.direction ?? "asc",
  }));
  return sortRows(filtered, [...groupSorts, ...rules.sorts.filter((rule) => !groupKeys.has(rule.key))], report.fields);
}

export const exportLocale = (state: WizardState, uiLocale: Locale): Locale =>
  state.formatting.useDefaultLanguage ? uiLocale : state.formatting.language;

interface MetadataInput {
  state: WizardState;
  page: PageContext;
  rules: ResolvedRules;
  plan: Pick<ExportPlan, "title" | "locale" | "env" | "t" | "rows">;
  now: Date;
}

function metadataLines({ state, page, rules, plan: { title, locale, env, t, rows }, now }: MetadataInput): MetaLine[] {
  const describeEnv = { fields: page.report.fields, t, tData: env.tData };
  const lines: MetaLine[] = [
    { label: t("export.meta.report"), value: title },
    { label: t("export.meta.exportedAt"), value: env.format.dateTime(now.toISOString()) },
    { label: t("export.meta.language"), value: t(`export.lang.${locale}`) },
    { label: t("export.meta.rows"), value: String(rows.length) },
  ];
  if (!state.includeFilters) return lines;

  const active = rules.filters.filter((rule) => rule.enabled !== false);
  const none = t("export.meta.none");
  lines.push({ label: t("export.meta.filters"), value: active.length > 0 ? t(`export.relation.${rules.relation}`) : none, heading: true });
  active.forEach((rule, index) => lines.push({ label: String(index + 1), value: describeFilter(rule, describeEnv) }));
  if (rules.liveFilters && page.view.search.trim()) lines.push({ label: t("export.meta.search"), value: page.view.search.trim() });
  lines.push({ label: t("export.meta.sorts"), value: rules.sorts.length > 0 ? "" : none, heading: true });
  rules.sorts.forEach((rule, index) => lines.push({ label: String(index + 1), value: describeSort(rule, describeEnv) }));
  return lines;
}

/** The typed name made safe, or the generated default when it is empty. Without extension. */
export function resolveFileName(state: WizardState, page: PageContext, now: Date): string {
  const rules = resolveRules(state, page);
  const title = translatorFor(exportLocale(state, page.uiLocale)).t(page.report.titleKey);
  const filtered = rules.filters.length > 0 || (rules.liveFilters && page.view.search.trim() !== "");
  return sanitizeFileName(state.fileName) || defaultFileName({ title, filtered, custom: state.source === "custom", now });
}

/** Wizard choices + page → the plan the generators write. */
export function buildPlan(state: WizardState, page: PageContext, now: Date = new Date()): ExportPlan {
  const { report } = page;
  const locale = exportLocale(state, page.uiLocale);
  const { t, tData } = translatorFor(locale);
  const env: CellEnv = { format: createFormatters(locale), t, tData, formatting: state.formatting };
  const isWorkbook = state.format === "xlsx";

  const rules = resolveRules(state, page);
  const grouping = resolveGrouping(state, report);
  const rows = resolveRows({ page, rules, grouping, now });
  const fields = resolveColumns(state, page);
  const headers = uniqueHeaders(fields.map((field) => t(field.labelKey)));
  const title = t(report.titleKey);

  const summaryFields = state.summary.fields.flatMap(({ field: key, calc }) => {
    const field = report.fields.find((candidate) => candidate.key === key);
    return field ? [{ field, calc }] : [];
  });
  const base = { title, locale, env, t, rows };

  return {
    ...base,
    format: state.format,
    fileName: resolveFileName(state, page, now),
    rtl: DIRECTION[locale] === "rtl",
    columns: fields.map((field, index) => ({ field, header: headers[index] })),
    summary: isWorkbook && state.summary.enabled && summaryFields.length > 0 ? { label: state.summary.label, fields: summaryFields } : null,
    grouping,
    charts:
      isWorkbook && state.charts.enabled
        ? page.charts
            .filter((chart) => state.charts.selected.includes(chart.id))
            .map((chart) => ({ title: chart.title[locale], rows: chart.table(rows, locale) }))
        : [],
    metadata: state.includeMetadata ? metadataLines({ state, page, rules, plan: base, now }) : null,
    design: state.design,
    csvDelimiter: state.csvDelimiter,
  };
}
