import type { CellValue, FieldDef, ReportDef } from "@/data/types";
import { cellText } from "@/features/grid/cells";
import { ALL_OPTION, toOption } from "@/features/grid/paging";
import type { FilterRule, ViewState } from "@/features/report/viewState";
import type { I18nKey, useI18n } from "@/i18n";
import type { Formatters } from "@/lib/format";

export const PREVIEW_SECTIONS = ["columns", "filters", "sorts", "grouping", "totals", "widgets", "charts", "page"] as const;
export type PreviewSectionId = (typeof PREVIEW_SECTIONS)[number];

export interface PreviewSection {
  id: PreviewSectionId;
  title: string;
  /** Short answer shown next to the title: a count, "All" or "None". */
  summary: string;
  items: string[];
}

type I18n = ReturnType<typeof useI18n>;

export interface DescribeInput {
  report: ReportDef;
  state: ViewState;
  t: I18n["t"];
  tData: I18n["tData"];
  format: Formatters;
  /** Widget and chart titles by id, from the report's summary configuration. */
  widgetTitles: ReadonlyMap<string, string>;
  chartTitles: ReadonlyMap<string, string>;
}

/** Values listed per filter before the rest is folded into "+N more". */
export const MAX_FILTER_VALUES = 3;
// Operator and period labels belong to the filters feature; a name it has no label for is shown as stored.
export const OPERATOR_PREFIX = "filters.op";
export const PERIOD_PREFIX = "filters.period";
const ALWAYS_SHOWN: ReadonlySet<PreviewSectionId> = new Set(["widgets", "charts"]);
const SORT_LABELS: readonly I18nKey[] = ["views.preview.sort.primary", "views.preview.sort.secondary"];
const TITLES: Record<PreviewSectionId, I18nKey> = {
  columns: "views.preview.columns",
  filters: "views.preview.filters",
  sorts: "views.preview.sorts",
  grouping: "views.preview.grouping",
  totals: "views.preview.totals",
  widgets: "views.preview.widgets",
  charts: "views.preview.charts",
  page: "views.preview.page",
};

/** Everything a view contains, as plain text per section. The preview and the overwrite confirmation both read it. */
export function describeView({ report, state, t, tData, format, widgetTitles, chartTitles }: DescribeInput): PreviewSection[] {
  const fields = new Map(report.fields.map((field) => [field.key, field]));
  const label = (key: string) => {
    const field = fields.get(key);
    return field ? t(field.labelKey) : key;
  };
  const valueText = (field: FieldDef | undefined, value: CellValue) => {
    if (typeof value === "boolean") return t(value ? "bool.yes" : "bool.no");
    return field ? cellText(value, { field, row: {}, format, t, tData }) : String(value ?? "");
  };

  // A preset period or a second field replaces the typed values.
  const comparedWith = (rule: FilterRule) => {
    if (rule.period) return tData(PERIOD_PREFIX, rule.period);
    return rule.compareField ? label(rule.compareField) : null;
  };

  const describeFilter = (rule: FilterRule) => {
    const field = fields.get(rule.field);
    const shown = rule.values.slice(0, MAX_FILTER_VALUES).map((value) => valueText(field, value));
    const hidden = rule.values.length - shown.length;
    if (hidden > 0) shown.push(t("views.preview.more", { count: hidden }));
    const text = `${label(rule.field)} · ${tData(OPERATOR_PREFIX, rule.operator)} ${comparedWith(rule) ?? shown.join(", ")}`.trim();
    return rule.enabled === false ? t("views.preview.filterOff", { filter: text }) : text;
  };

  const counted = (items: string[]) => ({ summary: String(items.length), items });
  // Ids the report no longer has are ignored, as they are when the view is applied.
  const visibility = (ids: readonly string[] | null, titles: ReadonlyMap<string, string>) => {
    if (ids === null) return { summary: t("views.preview.all"), items: [t("views.preview.allShown")] };
    const shown = ids.flatMap((id) => titles.get(id) ?? []);
    return shown.length > 0 ? counted(shown) : { summary: t("views.preview.none"), items: [t("views.preview.noneShown")] };
  };
  const activeFilters = state.filters.filter((rule) => rule.enabled !== false).length;

  const content: Record<PreviewSectionId, { summary: string; items: string[] }> = {
    columns: counted(state.columns.map(label)),
    filters: {
      summary: String(activeFilters),
      // How filters combine only matters once there are two of them.
      items: [...(state.filters.length > 1 ? [t(`views.relation.${state.relation}`)] : []), ...state.filters.map(describeFilter)],
    },
    sorts: counted(
      state.sorts.map((rule, index) =>
        t(SORT_LABELS[index] ?? "views.preview.sort.other", { n: index + 1, field: label(rule.key), direction: t(`views.direction.${rule.direction}`) }),
      ),
    ),
    grouping: counted(state.groupBy.map((key, index) => t("views.preview.level", { n: index + 1, field: label(key) }))),
    totals: counted(
      Object.entries(state.totals).map(([key, aggregate]) => t("views.preview.total", { field: label(key), calculation: t(`views.aggregate.${aggregate}`) })),
    ),
    widgets: visibility(state.widgets, widgetTitles),
    charts: visibility(state.charts, chartTitles),
    page: {
      summary: "",
      items: [toOption(state.pageSize) === ALL_OPTION ? t("views.preview.pageSizeAll") : t("views.preview.pageSize", { count: state.pageSize })],
    },
  };

  // A section appears only when it has content. Widgets and charts always do: "all" and "none" are both answers.
  return PREVIEW_SECTIONS.map((id) => ({ id, title: t(TITLES[id]), ...content[id] })).filter(
    (section) => section.items.length > 0 || ALWAYS_SHOWN.has(section.id),
  );
}
