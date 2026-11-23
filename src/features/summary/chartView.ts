import { mean } from "./aggregate";
import { OTHER_KEY, type ChartData } from "./chartData";
import type { ChartType } from "./config";

/** Chart types whose legend lists slices (categories) instead of series. */
export const PIE_TYPES: ReadonlySet<ChartType> = new Set(["pie", "doughnut"]);

export interface LegendEntry {
  key: string;
  label: string;
  isOther: boolean;
}

/** What the legend can hide: the slices of a pie, the series of any other chart. Keys are raw values, so they survive a data refresh. */
export function legendEntries(data: ChartData, type: ChartType): LegendEntry[] {
  const items = PIE_TYPES.has(type) ? data.categories : data.series;
  return items.map(({ key, label }) => ({ key, label, isOther: key === OTHER_KEY }));
}

/** Hidden keys that no longer exist in the data are dropped, so an item that comes back is visible again. */
export function pruneHidden(hidden: readonly string[], keys: readonly string[]): readonly string[] {
  const pruned = hidden.filter((key) => keys.includes(key));
  return pruned.length === hidden.length ? hidden : pruned;
}

export function toggleHidden(hidden: readonly string[], key: string): string[] {
  return hidden.includes(key) ? hidden.filter((item) => item !== key) : [...hidden, key];
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  /** Part of the slices that are still visible, 0 to 1. */
  share: number;
}

/** The first series as pie slices, without the hidden ones. */
export function visibleSlices(data: ChartData, hidden: readonly string[]): Slice[] {
  const values = data.series[0]?.values ?? [];
  const visible = data.categories.map((category, index) => ({ ...category, value: values[index] ?? 0 })).filter(({ key }) => !hidden.includes(key));
  const total = visible.reduce((sum, slice) => sum + slice.value, 0);
  return visible.map((slice) => ({ ...slice, share: total === 0 ? 0 : slice.value / total }));
}

interface Point {
  label: string;
  value: number;
}

export interface ChartStats {
  /** "series" compares whole series (a breakdown); "categories" compares the categories of one series. */
  mode: "categories" | "series";
  categories: number;
  series: number;
  total: number;
  top: Point;
  low: Point;
}

interface StatsInput {
  data: ChartData;
  type: ChartType;
  hidden: readonly string[];
}

/** The facts the one-sentence description is built from, over what is visible. Null when nothing is. */
export function chartStats({ data, type, hidden }: StatsInput): ChartStats | null {
  const pie = PIE_TYPES.has(type);
  const series = pie ? data.series.slice(0, 1) : data.series.filter(({ key }) => !hidden.includes(key));
  const breakdown = !pie && data.series.length > 1;
  const score = (values: readonly number[]) => (data.aggregation === "average" ? mean(values) : values.reduce((sum, n) => sum + n, 0));
  let points: Point[] = data.categories.map(({ label }, index) => ({ label, value: series[0]?.values[index] ?? 0 }));
  if (pie) points = visibleSlices(data, hidden);
  if (breakdown) points = series.map(({ label, values }) => ({ label, value: score(values) }));
  if (points.length === 0 || series.length === 0) return null;
  const ordered = [...points].sort((a, b) => b.value - a.value);
  return {
    mode: breakdown ? "series" : "categories",
    categories: pie ? points.length : data.categories.length,
    series: series.length,
    total: points.reduce((sum, point) => sum + point.value, 0),
    top: ordered[0],
    low: ordered[ordered.length - 1],
  };
}
