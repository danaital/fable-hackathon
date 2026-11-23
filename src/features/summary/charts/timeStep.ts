import type { FieldType } from "@/data/types";
import type { ChartConfig, ChartType } from "../config";
import { currentWindow, inWindow } from "../periods";
import { isBlank, type Fields, type Rows } from "../values";

// A time trend that covers a short period is regrouped by a finer step, so it still has points to connect.

/** Coarsest first. */
const STEPS = ["year", "month", "week", "day"] as const;
export type TimeStep = (typeof STEPS)[number];

export const DATE_TYPES: ReadonlySet<FieldType> = new Set(["date", "datetime"]);
/** Chart types that connect their points, so one point alone draws nothing readable. */
export const TREND_TYPES: ReadonlySet<ChartType> = new Set(["line", "area"]);
/** Fewer points than this is no trend: the chart is drawn as bars instead. */
export const MIN_TREND_POINTS = 2;
/** A step is good enough once it gives this many points; below it a finer step is tried. */
const GOOD_TREND_POINTS = 3;
const DEFAULT_STEP: TimeStep = "month";
const DAY_MS = 86_400_000;
const DAYS_IN_WEEK = 7;
/** `getUTCDay` counts from Sunday; this shift makes Monday day 0. */
const MONDAY_SHIFT = 6;
const LENGTH = { year: 4, month: 7, day: 10 } as const;

/** The bucket an ISO day (YYYY-MM-DD) falls in. A week is named by its first day. */
export function bucketOf(day: string, step: TimeStep): string {
  if (step !== "week") return day.slice(0, LENGTH[step]);
  // shortcut: weeks start on Monday (ISO 8601) in every language, read the locale's first day once Intl.Locale week info is in every browser.
  const ms = Date.parse(`${day.slice(0, LENGTH.day)}T00:00:00Z`);
  if (Number.isNaN(ms)) return day;
  const sinceMonday = (new Date(ms).getUTCDay() + MONDAY_SHIFT) % DAYS_IN_WEEK;
  return new Date(ms - sinceMonday * DAY_MS).toISOString().slice(0, LENGTH.day);
}

/**
 * The step to group days by: the configured one while it gives a real trend, else the coarsest finer step that does
 * (month, then week, then day). With no such step it settles for two points, and with none of those it stays configured.
 */
export function pickTimeStep(days: readonly string[], configured: TimeStep): { step: TimeStep; buckets: number } {
  const steps = STEPS.slice(STEPS.indexOf(configured));
  const counts = steps.map((step) => new Set(days.map((day) => bucketOf(day, step))).size);
  for (const enough of [GOOD_TREND_POINTS, MIN_TREND_POINTS]) {
    const at = counts.findIndex((count) => count >= enough);
    if (at >= 0) return { step: steps[at], buckets: counts[at] };
  }
  return { step: configured, buckets: counts[0] };
}

interface TimeViewInput {
  chart: ChartConfig;
  rows: Rows;
  fields: Fields;
  now: Date;
}

interface TimeView {
  chart: ChartConfig;
  rows: Rows;
  /** The finer step the chart was regrouped by; null when it is drawn as configured. */
  step: TimeStep | null;
}

/** A line or area chart over a date field, regrouped by a finer step when its rows cover a short period. */
export function timeView({ chart, rows, fields, now }: TimeViewInput): TimeView {
  const key = chart.groupBy ?? chart.dataField;
  const type = fields.find((field) => field.key === key)?.type;
  if (!TREND_TYPES.has(chart.type) || !type || !DATE_TYPES.has(type)) return { chart, rows, step: null };

  // The chart's own date range is applied here, so the step is chosen from the days it will really show.
  const range = chart.dateRange;
  const window = range ? currentWindow(range, now) : null;
  const inRange = range && window ? rows.filter((row) => inWindow(row[range.field], window)) : rows;
  const dayOf = (row: Rows[number]) => (isBlank(row[key]) ? null : String(row[key]).slice(0, LENGTH.day));
  const configured = chart.granularity ?? DEFAULT_STEP;
  const { step, buckets } = pickTimeStep(
    inRange.flatMap((row) => dayOf(row) ?? []),
    configured,
  );
  if (step === configured) return { chart, rows, step: null };

  // The data builder knows days, months and years: a week is fed to it as the day the week starts on.
  const toWeek = (row: Rows[number]) => {
    const day = dayOf(row);
    return day === null ? row : { ...row, [key]: bucketOf(day, step) };
  };
  const regrouped = step === "week" ? inRange.map(toWeek) : inRange;
  return {
    // No point of a regrouped trend is cut off by the category limit.
    chart: { ...chart, dateRange: undefined, granularity: step === "week" ? "day" : step, limit: Math.max(chart.limit, buckets) },
    rows: regrouped,
    step,
  };
}
