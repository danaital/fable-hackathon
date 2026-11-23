import type { FieldType, Row } from "@/data/types";
import type { ChartConfig } from "./config";
import { currentWindow, inWindow } from "./periods";
import { PLAIN, isBlank, readColumn, type Fields, type Rows, type Unit } from "./values";

/** Key of the "Other" category or series: everything folded past a limit, and blank values in a breakdown. */
export const OTHER_KEY = "__other__";
/** Key of the only series of a chart without a breakdown. */
export const COUNT_SERIES_KEY = "__count__";

export interface ChartCategory {
  key: string;
  label: string;
}

export interface ChartSeries {
  key: string;
  label: string;
  /** One value per category. */
  values: number[];
  /** Part of the category's total, 0 to 1, per category. Null when parts make no sense (averages). */
  shares: number[] | null;
}

export interface ChartData {
  categories: ChartCategory[];
  series: ChartSeries[];
  /** How many categories were summed into "Other". */
  foldedCount: number;
  aggregation: "count" | "sum" | "average";
  unit: Unit;
}

/** Turns a raw category or series value of a field into the text the reader sees. */
export type LabelFor = (key: string, fieldKey: string) => string;

interface BuildInput {
  chart: ChartConfig;
  rows: Rows;
  fields: Fields;
  now: Date;
  labelFor: LabelFor;
  /** Label of the single series of a chart without a breakdown: the chart's title. */
  title: string;
}

const BUCKET_LENGTH: Record<NonNullable<ChartConfig["granularity"]>, number> = { day: 10, month: 7, year: 4 };
const DEFAULT_GRANULARITY = "month";
const DATE_TYPES: ReadonlySet<FieldType> = new Set(["date", "datetime"]);
/** Field types whose "label" order is the order of the raw values, not of the translated text. */
const ORDERED_BY_KEY: ReadonlySet<FieldType> = new Set(["date", "datetime", "number", "currency", "percent"]);

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

interface Entry extends ChartCategory {
  value: number;
}

function categoryReader(chart: ChartConfig, fields: Fields): { key: string; byKey: boolean; read: (row: Row) => string | null } {
  const key = chart.groupBy ?? chart.dataField;
  const type = fields.find((field) => field.key === key)?.type;
  const bucket = type && DATE_TYPES.has(type) ? BUCKET_LENGTH[chart.granularity ?? DEFAULT_GRANULARITY] : null;
  return {
    key,
    byKey: Boolean(type && ORDERED_BY_KEY.has(type)),
    read: (row) => {
      const cell = row[key];
      if (isBlank(cell)) return null;
      return bucket === null ? String(cell) : String(cell).slice(0, bucket);
    },
  };
}

/** Row count per distinct category value. Blank values are skipped. */
function countCategories({ chart, rows, fields, labelFor, title }: BuildInput): ChartData {
  const category = categoryReader(chart, fields);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = category.read(row);
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const entries: Entry[] = [...counts].map(([key, value]) => ({ key, label: labelFor(key, category.key), value }));
  const byLabel = (a: Entry, b: Entry) => (category.byKey ? natural(a.key, b.key) : natural(a.label, b.label));
  if (chart.sortBy === "value") entries.sort((a, b) => b.value - a.value || byLabel(a, b));
  if (chart.sortBy === "label") entries.sort(byLabel);

  // With "Other" on, a group-by chart keeps one place for it so the total stays within the limit; a value-count chart adds it on top.
  const keep = chart.showOther && chart.groupBy ? Math.max(chart.limit - 1, 0) : chart.limit;
  const kept = entries.slice(0, keep);
  const folded = chart.showOther ? entries.slice(keep) : [];
  if (folded.length > 0) {
    kept.push({ key: OTHER_KEY, label: labelFor(OTHER_KEY, category.key), value: folded.reduce((total, entry) => total + entry.value, 0) });
  }
  return {
    categories: kept.map(({ key, label }) => ({ key, label })),
    series: kept.length === 0 ? [] : [{ key: COUNT_SERIES_KEY, label: title, values: kept.map((entry) => entry.value), shares: null }],
    foldedCount: folded.length,
    aggregation: "count",
    unit: PLAIN,
  };
}

interface Tally {
  rows: number;
  sum: number;
  numbers: number;
}

/** One series per value of the breakdown field, one point per category: count, sum or average of the data field. */
function breakDown(input: BuildInput & { series: NonNullable<ChartConfig["series"]> }): ChartData {
  const { chart, rows, fields, labelFor, series } = input;
  const category = categoryReader(chart, fields);
  const { aggregation } = series;
  const column = aggregation === "count" ? null : readColumn({ rows, key: chart.dataField, fields });

  // series key → category key → tally; a blank series or category is filed under OTHER_KEY.
  const tallies = new Map<string, Map<string, Tally>>();
  const categoryKeys = new Set<string>();
  rows.forEach((row, index) => {
    const seriesCell = row[series.field];
    const seriesKey = isBlank(seriesCell) ? OTHER_KEY : String(seriesCell);
    const categoryKey = category.read(row) ?? OTHER_KEY;
    categoryKeys.add(categoryKey);
    const bySeries = tallies.get(seriesKey) ?? new Map<string, Tally>();
    tallies.set(seriesKey, bySeries);
    const tally = bySeries.get(categoryKey) ?? { rows: 0, sum: 0, numbers: 0 };
    bySeries.set(categoryKey, tally);
    const value = column?.numbers[index] ?? null;
    tally.rows += 1;
    tally.sum += value ?? 0;
    tally.numbers += value === null ? 0 : 1;
  });

  const valueOf: Record<typeof aggregation, (tally: Tally) => number> = {
    count: (tally) => tally.rows,
    sum: (tally) => tally.sum,
    average: (tally) => (tally.numbers === 0 ? 0 : tally.sum / tally.numbers),
  };
  // Series are ranked by their aggregate, or by row count for averages; ties by name.
  const weights = new Map(
    [...tallies].map(([key, bySeries]) => [
      key,
      [...bySeries.values()].reduce((total, tally) => total + (aggregation === "sum" ? tally.sum : tally.rows), 0),
    ]),
  );
  const ranked = [...tallies.keys()]
    .filter((key) => key !== OTHER_KEY)
    .sort((a, b) => (weights.get(b) ?? 0) - (weights.get(a) ?? 0) || natural(a, b));
  const keptKeys = ranked.slice(0, series.maxSeries);
  const pooledKeys = [...ranked.slice(series.maxSeries), ...(tallies.has(OTHER_KEY) ? [OTHER_KEY] : [])];

  const categories = [...categoryKeys].filter((key) => key !== OTHER_KEY).sort(natural);
  if (categoryKeys.has(OTHER_KEY)) categories.push(OTHER_KEY);

  const pool = (keys: readonly string[], categoryKey: string): Tally =>
    keys.reduce<Tally>(
      (total, key) => {
        const tally = tallies.get(key)?.get(categoryKey);
        return tally ? { rows: total.rows + tally.rows, sum: total.sum + tally.sum, numbers: total.numbers + tally.numbers } : total;
      },
      { rows: 0, sum: 0, numbers: 0 },
    );
  const groups = [...keptKeys.map((key) => ({ key, keys: [key] })), ...(pooledKeys.length > 0 ? [{ key: OTHER_KEY, keys: pooledKeys }] : [])];
  const values = groups.map((group) => categories.map((categoryKey) => valueOf[aggregation](pool(group.keys, categoryKey))));
  const totals = categories.map((_, index) => values.reduce((total, row) => total + row[index], 0));

  return {
    categories: categories.map((key) => ({ key, label: labelFor(key, category.key) })),
    series: groups.map((group, index) => ({
      key: group.key,
      label: labelFor(group.key, series.field),
      values: values[index],
      shares: aggregation === "average" ? null : values[index].map((value, at) => (totals[at] === 0 ? 0 : value / totals[at])),
    })),
    foldedCount: 0,
    aggregation,
    unit: column?.unit ?? PLAIN,
  };
}

/** Chart data from rows. Throws the mixed-currency notice instead of summing mixed money. */
export function buildChartData(input: BuildInput): ChartData {
  const { chart, now } = input;
  const range = chart.dateRange;
  const window = range ? currentWindow(range, now) : null;
  const rows = range && window ? input.rows.filter((row) => inWindow(row[range.field], window)) : input.rows;
  return chart.series ? breakDown({ ...input, rows, series: chart.series }) : countCategories({ ...input, rows });
}
