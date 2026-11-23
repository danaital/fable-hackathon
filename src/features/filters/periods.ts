import type { FieldType } from "@/data/types";

/** Preset periods are stored by name and turned into dates against "now" every time rows are filtered. */
export const DATE_PERIODS = [
  "today",
  "yesterday",
  "tomorrow",
  "this_week",
  "last_week",
  "next_week",
  "week_to_date",
  "this_month",
  "last_month",
  "next_month",
  "month_to_date",
  "this_month_last_year",
  "this_quarter",
  "last_quarter",
  "next_quarter",
  "quarter_to_date",
  "same_quarter_last_year",
  "last_quarter_last_year",
  "next_quarter_last_year",
  "q1_last_year",
  "q2_last_year",
  "q3_last_year",
  "q4_last_year",
  "this_year",
  "last_year",
  "next_year",
  "year_to_date",
  "last_2_days_exact",
  "last_3_days_exact",
  "last_3_days",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "last_365_days",
  "next_7_days",
  "next_30_days",
  "last_24_hours",
  "next_24_hours",
  "next_72_hours",
  "today_and_after",
  "before_and_including_today",
] as const;
export type DatePeriod = (typeof DATE_PERIODS)[number];

/** Offered on datetime fields in addition to the date periods. */
export const HOUR_PERIODS = [
  "this_hour",
  "last_hour",
  "next_hour",
  "last_2_hours",
  "last_2_hours_rounded",
  "last_4_hours",
  "last_6_hours",
  "last_12_hours",
  "next_2_hours",
  "next_4_hours",
  "next_6_hours",
  "next_12_hours",
  "today_morning",
  "today_afternoon",
  "today_evening",
  "now_and_after",
  "before_now",
] as const;
export type HourPeriod = (typeof HOUR_PERIODS)[number];
export type TimePeriod = DatePeriod | HourPeriod;

/** The value shown when the user picks the dates by hand; it is never stored on a rule. */
export const CUSTOM_PERIOD = "custom";

const HOUR_MS = 3_600_000;
const SECOND_MS = 1000;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_QUARTER = 3;
const LAST_MONTH_INDEX = 11;
// Sunday, as in both the English and the Hebrew calendar of the product this behavior comes from.
const WEEK_START_DAY = 0;
const NOON_HOUR = 12;
const EVENING_HOUR = 18;
const HOURS_PER_DAY = 24;

/** `null` marks an open end: "today and after" has no last day. */
interface PeriodRange {
  start: Date | null;
  end: Date | null;
}
interface ClosedRange extends PeriodRange {
  start: Date;
  end: Date;
}
type Resolver<Range extends PeriodRange = ClosedRange> = (now: Date) => Range;

const day = (date: Date, offset = 0) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
const whole = (start: Date, end: Date): ClosedRange => ({ start: day(start), end: endOfDay(end) });
const shiftHours = (date: Date, hours: number) => new Date(date.getTime() + hours * HOUR_MS);
const hourStart = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
const quarterStartMonth = (now: Date) => Math.floor(now.getMonth() / MONTHS_PER_QUARTER) * MONTHS_PER_QUARTER;

/** Whole days, as offsets from today. */
const days = (from: number, to: number): Resolver => (now) => whole(day(now, from), day(now, to));

const weekStart = (now: Date) => day(now, -((now.getDay() - WEEK_START_DAY + DAYS_PER_WEEK) % DAYS_PER_WEEK));
const week = (offset: number): Resolver => (now) => {
  const start = day(weekStart(now), offset * DAYS_PER_WEEK);
  return whole(start, day(start, DAYS_PER_WEEK - 1));
};

const month = (offset: number, yearOffset = 0): Resolver => (now) => {
  const year = now.getFullYear() + yearOffset;
  const index = now.getMonth() + offset;
  // Day 0 of the next month is the last day of this one.
  return whole(new Date(year, index, 1), new Date(year, index + 1, 0));
};

const quarter = (offset: number, yearOffset = 0): Resolver => (now) => {
  const year = now.getFullYear() + yearOffset;
  const index = quarterStartMonth(now) + offset * MONTHS_PER_QUARTER;
  return whole(new Date(year, index, 1), new Date(year, index + MONTHS_PER_QUARTER, 0));
};

const quarterOfLastYear = (number: number): Resolver => (now) => {
  const year = now.getFullYear() - 1;
  return whole(new Date(year, (number - 1) * MONTHS_PER_QUARTER, 1), new Date(year, number * MONTHS_PER_QUARTER, 0));
};

const year = (offset: number): Resolver => (now) => {
  const value = now.getFullYear() + offset;
  return whole(new Date(value, 0, 1), new Date(value, LAST_MONTH_INDEX, 31));
};

/** From the start of a period up to today. */
const toDate = (period: Resolver): Resolver => (now) => whole(period(now).start, now);

/** To the second: N calendar days back, same clock time, up to now. */
const exactDaysBack = (count: number): Resolver => (now) => ({
  start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - count, now.getHours(), now.getMinutes(), now.getSeconds()),
  end: now,
});

/** To the second, as hour offsets from now. */
const hours = (from: number, to: number): Resolver => (now) => ({ start: shiftHours(now, from), end: shiftHours(now, to) });

/** A whole clock hour, as an offset from the current one. */
const clockHour = (offset: number): Resolver => (now) => {
  const start = shiftHours(hourStart(now), offset);
  return { start, end: new Date(start.getTime() + HOUR_MS - SECOND_MS) };
};

/** Part of today, from the start of one hour up to (not including) the start of another. */
const todayHours = (from: number, until: number): Resolver => (now) => {
  const midnight = day(now);
  return { start: shiftHours(midnight, from), end: new Date(shiftHours(midnight, until).getTime() - SECOND_MS) };
};

const RESOLVERS: Record<TimePeriod, Resolver<PeriodRange>> = {
  today: days(0, 0),
  yesterday: days(-1, -1),
  tomorrow: days(1, 1),
  this_week: week(0),
  last_week: week(-1),
  next_week: week(1),
  week_to_date: toDate(week(0)),
  this_month: month(0),
  last_month: month(-1),
  next_month: month(1),
  month_to_date: toDate(month(0)),
  this_month_last_year: month(0, -1),
  this_quarter: quarter(0),
  last_quarter: quarter(-1),
  next_quarter: quarter(1),
  quarter_to_date: toDate(quarter(0)),
  same_quarter_last_year: quarter(0, -1),
  last_quarter_last_year: quarter(-1, -1),
  next_quarter_last_year: quarter(1, -1),
  q1_last_year: quarterOfLastYear(1),
  q2_last_year: quarterOfLastYear(2),
  q3_last_year: quarterOfLastYear(3),
  q4_last_year: quarterOfLastYear(4),
  this_year: year(0),
  last_year: year(-1),
  next_year: year(1),
  year_to_date: toDate(year(0)),
  last_2_days_exact: exactDaysBack(2),
  last_3_days_exact: exactDaysBack(3),
  last_3_days: days(-2, 0),
  last_7_days: days(-6, 0),
  last_30_days: days(-29, 0),
  last_90_days: days(-89, 0),
  last_365_days: days(-364, 0),
  // One rule for every "next N days" period: N days starting tomorrow (the labels say so).
  next_7_days: days(1, 7),
  next_30_days: days(1, 30),
  last_24_hours: hours(-24, 0),
  next_24_hours: hours(0, 24),
  next_72_hours: hours(0, 72),
  today_and_after: (now) => ({ start: day(now), end: null }),
  before_and_including_today: (now) => ({ start: null, end: endOfDay(now) }),
  this_hour: clockHour(0),
  last_hour: clockHour(-1),
  next_hour: clockHour(1),
  last_2_hours: hours(-2, 0),
  last_2_hours_rounded: (now) => ({ start: shiftHours(hourStart(now), -2), end: hourStart(now) }),
  last_4_hours: hours(-4, 0),
  last_6_hours: hours(-6, 0),
  last_12_hours: hours(-12, 0),
  next_2_hours: hours(0, 2),
  next_4_hours: hours(0, 4),
  next_6_hours: hours(0, 6),
  next_12_hours: hours(0, 12),
  today_morning: todayHours(0, NOON_HOUR),
  today_afternoon: todayHours(NOON_HOUR, EVENING_HOUR),
  today_evening: todayHours(EVENING_HOUR, HOURS_PER_DAY),
  now_and_after: (now) => ({ start: now, end: null }),
  before_now: (now) => ({ start: null, end: now }),
};

/** Periods offered per field type; other types have no period menu. */
export const PERIODS_BY_TYPE: Partial<Record<FieldType, readonly TimePeriod[]>> = {
  date: DATE_PERIODS,
  datetime: [...DATE_PERIODS, ...HOUR_PERIODS],
};

export const isTimePeriod = (value: string | undefined): value is TimePeriod => value !== undefined && value in RESOLVERS;

const pad = (value: number) => String(value).padStart(2, "0");
/** Local calendar day as `YYYY-MM-DD`. */
export const toDateString = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** Local date and time as `YYYY-MM-DDTHH:mm:ss`, the form a date-time picker reads. */
export const toDateTimeString = (date: Date) =>
  `${toDateString(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

interface PeriodBoundsInput {
  period: string | undefined;
  fieldType: FieldType;
  now: Date;
}

/**
 * [from, to] for a preset period, or `null` for a custom or unknown period. A `null` bound is an open end.
 * Date fields get whole days; date-time fields get bounds to the second. Resolved in the device's time zone.
 */
export function periodBounds({ period, fieldType, now }: PeriodBoundsInput): [string | null, string | null] | null {
  if (!isTimePeriod(period)) return null;
  const { start, end } = RESOLVERS[period](new Date(Math.floor(now.getTime() / SECOND_MS) * SECOND_MS));
  const write = fieldType === "datetime" ? toDateTimeString : toDateString;
  return [start && write(start), end && write(end)];
}
