import type { I18nKey } from "@/i18n";
import type { ChartStats } from "../chartView";
import type { ChartConfig, ChartType } from "../config";

type Translate = (key: I18nKey, vars?: Record<string, string | number>) => string;

interface DescribeInput {
  /** Null when nothing is visible. */
  stats: ChartStats | null;
  type: ChartType;
  title: string;
  t: Translate;
  formatValue: (value: number) => string;
  /** Formats a part of the whole, 0 to 1. */
  formatShare: (share: number) => string;
  /** False for averages, where a part of the total means nothing. */
  withShares: boolean;
}

/** The one-sentence text alternative of a chart, built from what is visible in it. */
export function describeChart({ stats, type, title, t, formatValue, formatShare, withShares }: DescribeInput): string {
  if (!stats) return t("summary.noData");
  const valueOf = (value: number) =>
    withShares && stats.total > 0
      ? t("summary.chart.shareOfAll", { value: formatValue(value), percent: formatShare(value / stats.total) })
      : formatValue(value);
  return t(`summary.chart.describe.${stats.mode}`, {
    type: t(`summary.chart.type.${type}`),
    title,
    count: stats.categories,
    series: stats.series,
    total: formatValue(stats.total),
    top: stats.top.label,
    topValue: valueOf(stats.top.value),
    low: stats.low.label,
    lowValue: valueOf(stats.low.value),
  });
}

const SERIES_SUBTITLES: Record<NonNullable<ChartConfig["series"]>["aggregation"], I18nKey> = {
  count: "charts.subtitle.series.count",
  sum: "charts.subtitle.series.sum",
  average: "charts.subtitle.series.average",
};

interface SubtitleInput {
  chart: ChartConfig;
  fieldLabel: (key: string) => string;
  t: Translate;
}

/** Says what the chart measures, from its configuration: "Sum of Items by Order date, split by Channel". */
export function chartSubtitle({ chart, fieldLabel, t }: SubtitleInput): string {
  const category = fieldLabel(chart.groupBy ?? chart.dataField);
  if (!chart.series) return t("charts.subtitle.count", { category });
  return t(SERIES_SUBTITLES[chart.series.aggregation], { category, field: fieldLabel(chart.dataField), series: fieldLabel(chart.series.field) });
}
