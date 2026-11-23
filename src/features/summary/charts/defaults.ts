import type { FieldDef, FieldType, ReportDef } from "@/data/types";
import { en } from "@/i18n/en";
import { he } from "@/i18n/he";
import { summaryConfigSchema, type ChartConfig, type LocalizedText, type SummaryConfigInput } from "../config";
import { DATE_TYPES } from "./timeStep";

type ChartInput = SummaryConfigInput["charts"][number];
type TitleKey = "charts.default.byField" | "charts.default.byMonth";

const CATEGORY_TYPES: ReadonlySet<FieldType> = new Set(["enum", "status"]);
/** One chart type per category field, in order; also the number of category charts. */
const CATEGORY_CHART_TYPES = ["bar", "doughnut"] as const;
const FALLBACK_LIMIT = 8;
const FIELD_PLACEHOLDER = "{field}";

const titleOf = (key: TitleKey, field: FieldDef): LocalizedText => ({
  en: en[key].replace(FIELD_PLACEHOLDER, en[field.labelKey]),
  he: he[key].replace(FIELD_PLACEHOLDER, he[field.labelKey]),
});

/**
 * Charts for a report that has no chart configuration: a row count by each of its first two category fields
 * and a row count per month on its first date field. A report with neither counts rows by its first field.
 */
export function defaultCharts(report: ReportDef): ChartConfig[] {
  const categories = report.fields.filter((field) => CATEGORY_TYPES.has(field.type)).slice(0, CATEGORY_CHART_TYPES.length);
  const date = report.fields.find((field) => DATE_TYPES.has(field.type));
  const charts: ChartInput[] = categories.map((field, index) => ({
    id: `default_${field.key}`,
    type: CATEGORY_CHART_TYPES[index],
    dataField: field.key,
    title: titleOf("charts.default.byField", field),
  }));
  if (date) {
    charts.push({ id: `default_${date.key}_month`, type: "line", dataField: date.key, granularity: "month", sortBy: "label", title: titleOf("charts.default.byMonth", date) });
  }
  const first = report.fields[0];
  if (charts.length === 0 && first) {
    charts.push({ id: `default_${first.key}`, type: "horizontalBar", dataField: first.key, limit: FALLBACK_LIMIT, showOther: true, title: titleOf("charts.default.byField", first) });
  }
  // Parsed like any other configuration, so the defaults carry the same default settings.
  return summaryConfigSchema.parse({ widgets: [], charts }).charts;
}
