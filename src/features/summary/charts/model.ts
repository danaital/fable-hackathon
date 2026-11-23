import type { ThemeMode } from "@/lib/prefs";
import { buildChartData, type ChartCategory, type ChartData, type LabelFor } from "../chartData";
import { PIE_TYPES, legendEntries, visibleSlices, type LegendEntry } from "../chartView";
import { evaluateCondition, type ConditionOutcome } from "../conditions";
import type { ChartConfig, ChartType } from "../config";
import { assignSlots, seriesStyle, type SeriesStyle } from "../palette";
import { SummaryNotice, type Fields, type NoticeCode, type Rows } from "../values";
import { MIN_TREND_POINTS, TREND_TYPES, timeView, type TimeStep } from "./timeStep";

export type ChartResult =
  /** `step` is the finer time step a short trend was regrouped by, null when the chart is grouped as configured. */
  | { kind: "data"; data: ChartData; step: TimeStep | null }
  | { kind: "withheld"; outcome: Exclude<ConditionOutcome, "met"> }
  | { kind: "notice"; code: NoticeCode; detail: string };

interface ComputeInput {
  chart: ChartConfig;
  rows: Rows;
  fields: Fields;
  now: Date;
  labelFor: LabelFor;
  title: string;
}

/** One chart's outcome: its data, or the reason there is none. Any other failure throws and is caught by the card's boundary. */
export function computeChart(input: ComputeInput): ChartResult {
  const outcome = evaluateCondition(input.chart.displayCondition, input.rows);
  if (outcome !== "met") return { kind: "withheld", outcome };
  try {
    const { chart, rows, step } = timeView(input);
    return { kind: "data", data: buildChartData({ ...input, chart, rows }), step };
  } catch (error) {
    if (error instanceof SummaryNotice) return { kind: "notice", code: error.code, detail: error.detail };
    throw error;
  }
}

/** The type a chart is drawn as: a line or area left with a single category has no trend to draw and becomes bars. */
export function drawnType(type: ChartType, data: ChartData): ChartType {
  return TREND_TYPES.has(type) && data.categories.length < MIN_TREND_POINTS ? "bar" : type;
}

export interface LegendItem extends LegendEntry {
  hidden: boolean;
  style: SeriesStyle;
  /** Shown after the label: a pie slice's part of the whole. */
  detail?: string;
}

export interface ModelSeries {
  key: string;
  label: string;
  style: SeriesStyle;
  /** Property of each `rows` entry that holds this series' value. Raw keys are not used: they can hold dots. */
  dataKey: string;
  /** One value per visible category. */
  values: number[];
  /** Part of the whole, 0 to 1, per category; null where a part makes no sense (averages). */
  shares: (number | null)[];
}

export type ModelRow = Record<string, string | number>;

/** What a card draws: only what is visible, with a stable look per series or slice. */
export interface ChartModel {
  pie: boolean;
  legend: LegendItem[];
  /** Visible categories. A pie leaves its hidden slices out. */
  categories: ChartCategory[];
  /** Visible series. A pie has one. */
  series: ModelSeries[];
  /** Pie only: the look of each visible category. */
  sliceStyles: SeriesStyle[];
  /** One entry per category for the charting library: `label` plus one number per series data key. */
  rows: ModelRow[];
}

interface ModelInput {
  data: ChartData;
  type: ChartType;
  hidden: readonly string[];
  mode: ThemeMode;
  /** "Other" is always this grey, with no texture. */
  otherColor: string;
}

export const LABEL_KEY = "label";
const dataKeyOf = (index: number) => `v${index}`;
const total = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0);

export function buildModel({ data, type, hidden, mode, otherColor }: ModelInput): ChartModel {
  const pie = PIE_TYPES.has(type);
  const entries = legendEntries(data, type);
  // Slots come from every entry, hidden or not, so hiding one never repaints the others.
  const slots = assignSlots(entries.map((entry) => entry.key));
  const other: SeriesStyle = { color: otherColor, fill: otherColor, dash: "", symbol: "circle" };
  const legend = entries.map((entry, index) => ({
    ...entry,
    hidden: hidden.includes(entry.key),
    style: entry.isOther ? other : seriesStyle(slots[index], mode),
  }));
  const styles = new Map(legend.map((item) => [item.key, item.style]));
  const styleOf = (key: string) => styles.get(key) ?? other;

  if (pie) {
    const slices = visibleSlices(data, hidden);
    const first = data.series[0];
    const series: ModelSeries[] =
      first && slices.length > 0
        ? [{ key: first.key, label: first.label, style: other, dataKey: dataKeyOf(0), values: slices.map((slice) => slice.value), shares: slices.map((slice) => slice.share) }]
        : [];
    return {
      pie,
      legend,
      categories: slices.map(({ key, label }) => ({ key, label })),
      series,
      sliceStyles: slices.map((slice) => styleOf(slice.key)),
      rows: slices.map((slice) => ({ [LABEL_KEY]: slice.label, [dataKeyOf(0)]: slice.value })),
    };
  }

  const single = data.series.length === 1 && data.aggregation !== "average";
  const series = data.series
    .filter((item) => !hidden.includes(item.key))
    .map((item, index) => {
      const sum = total(item.values);
      // A breakdown carries each point's part of its category; a single series shows each category's part of the total.
      const shares = item.shares ?? item.values.map((value) => (single && sum !== 0 ? value / sum : null));
      return { key: item.key, label: item.label, style: styleOf(item.key), dataKey: dataKeyOf(index), values: item.values, shares };
    });
  return {
    pie,
    legend,
    categories: data.categories,
    series,
    sliceStyles: [],
    rows: data.categories.map((category, at) => ({
      [LABEL_KEY]: category.label,
      ...Object.fromEntries(series.map((item) => [item.dataKey, item.values[at] ?? 0])),
    })),
  };
}

/** Nothing to draw at all (as opposed to everything being hidden through the legend). */
export const isEmpty = (data: ChartData) => data.categories.length === 0 || data.series.length === 0;
