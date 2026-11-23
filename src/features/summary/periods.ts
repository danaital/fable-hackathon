import type { CellValue } from "@/data/types";
import type { PeriodConfig, PeriodRelationship, PeriodType } from "./config";

/** Whole days, both ends included, as ISO days (YYYY-MM-DD). */
export interface DateWindow {
  start: string;
  end: string;
}

const DAY_MS = 86_400_000;
const ISO_DAY_LENGTH = 10;
const MONTHS_IN_YEAR = 12;

type PeriodShape = { months: number; toDate: boolean } | { days: number };

const PERIODS: Record<PeriodType, PeriodShape> = {
  this_month: { months: 1, toDate: false },
  this_quarter: { months: 3, toDate: false },
  this_year: { months: 12, toDate: false },
  month_to_date: { months: 1, toDate: true },
  quarter_to_date: { months: 3, toDate: true },
  year_to_date: { months: 12, toDate: true },
  last_7_days: { days: 7 },
  last_30_days: { days: 30 },
  last_90_days: { days: 90 },
};
/** No current period configured: a snapshot from the start of the year to today. */
const SNAPSHOT_PERIOD: PeriodType = "year_to_date";

// All day arithmetic runs in UTC on calendar days, so daylight-saving shifts cannot move a boundary.
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, ISO_DAY_LENGTH);
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const addDays = (iso: string, days: number) => toIso(toMs(iso) + days * DAY_MS);
/** Day 0 of the next month is the last day of this one. */
const monthEnd = (year: number, month: number) => toIso(Date.UTC(year, month + 1, 0));
const parts = (iso: string) => {
  const date = new Date(toMs(iso));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
};

/** Same day of the month, `months` earlier or later, clamped to the length of the target month. */
function shiftMonths(iso: string, months: number): string {
  const { year, month, day } = parts(iso);
  const last = monthEnd(year, month + months);
  const shifted = toIso(Date.UTC(year, month + months, day));
  return parts(last).month === parts(shifted).month ? shifted : last;
}

const isMonthEnd = (iso: string) => monthEnd(parts(iso).year, parts(iso).month) === iso;

/** The calendar day of `now` in the user's own time zone. */
export function today(now: Date): string {
  return toIso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function resolvePeriod(type: PeriodType, now: Date): DateWindow {
  const shape = PERIODS[type];
  const end = today(now);
  if ("days" in shape) return { start: addDays(end, 1 - shape.days), end };
  const { year, month } = parts(end);
  const firstMonth = Math.floor(month / shape.months) * shape.months;
  const start = toIso(Date.UTC(year, firstMonth, 1));
  return { start, end: shape.toDate ? end : monthEnd(year, firstMonth + shape.months - 1) };
}

/** Explicit start and end win; else the period type; else the year-to-date snapshot. */
export function currentWindow(period: PeriodConfig | undefined, now: Date): DateWindow {
  if (period?.start && period.end) return { start: period.start, end: period.end };
  return resolvePeriod(period?.type ?? SNAPSHOT_PERIOD, now);
}

function previousPeriod(current: DateWindow, type: PeriodType | undefined): DateWindow {
  const shape = type ? PERIODS[type] : undefined;
  if (!shape || "days" in shape) {
    // Rolling or explicit window: the same number of days, ending the day before the current one starts.
    const end = addDays(current.start, -1);
    return { start: addDays(end, (toMs(current.start) - toMs(current.end)) / DAY_MS), end };
  }
  const start = shiftMonths(current.start, -shape.months);
  const unitEnd = addDays(current.start, -1);
  if (!shape.toDate) return { start, end: unitEnd };
  // A to-date window keeps its partial length, but never runs past the end of the previous unit.
  const partialEnd = addDays(start, (toMs(current.end) - toMs(current.start)) / DAY_MS);
  return { start, end: partialEnd < unitEnd ? partialEnd : unitEnd };
}

function samePeriodLastYear(current: DateWindow): DateWindow {
  const end = shiftMonths(current.end, -MONTHS_IN_YEAR);
  const { year, month } = parts(end);
  return { start: shiftMonths(current.start, -MONTHS_IN_YEAR), end: isMonthEnd(current.end) ? monthEnd(year, month) : end };
}

const RELATIONSHIPS: Record<PeriodRelationship, (current: DateWindow, type: PeriodType | undefined) => DateWindow> = {
  previous_period: previousPeriod,
  same_period_last_year: samePeriodLastYear,
};

interface PreviousWindowInput {
  current: DateWindow;
  /** The current period's type; absent for an explicit date range. */
  type?: PeriodType;
  previous?: { relationship: PeriodRelationship; start?: string; end?: string };
}

export function previousWindow({ current, type, previous }: PreviousWindowInput): DateWindow {
  if (previous?.start && previous.end) return { start: previous.start, end: previous.end };
  return RELATIONSHIPS[previous?.relationship ?? "previous_period"](current, type);
}

/** True when a date or date-time cell falls on a day inside the window. Blank and non-date cells are outside. */
export function inWindow(value: CellValue | undefined, { start, end }: DateWindow): boolean {
  if (typeof value !== "string") return false;
  const day = value.slice(0, ISO_DAY_LENGTH);
  return day >= start && day <= end;
}
