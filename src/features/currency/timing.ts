import type { Row } from "@/data/types";
import { SOURCE_CURRENCY, type CurrencySettings, type RateTimePeriod } from "@/features/settings/schema";
import { LATEST, MIN_RATE_DATE, isoDay } from "./codes";

const DAY_MS = 86_400_000;
const DAYS_IN_WEEK = 7;
const SATURDAY = 6;
const SUNDAY = 0;

const shift = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
// Trade days close on Saturday and Sunday (the ECB week), not the Israeli week.
const isWeekend = (date: Date) => date.getUTCDay() === SATURDAY || date.getUTCDay() === SUNDAY;

function stepOverWeekend(date: Date, direction: 1 | -1): Date {
  let day = shift(date, direction);
  while (isWeekend(day)) day = shift(day, direction);
  return day;
}

const PERIOD_DATE: Record<Exclude<RateTimePeriod, "custom">, (now: Date) => Date> = {
  today: (now) => now,
  yesterday: (now) => shift(now, -1),
  thisDayLastWeek: (now) => shift(now, -DAYS_IN_WEEK),
  lastTradeDay: (now) => stepOverWeekend(now, -1),
  nextTradeDay: (now) => stepOverWeekend(now, 1),
};

function rowDate(value: Row[string] | undefined): string | null {
  if (value === null || value === undefined || value === "") return LATEST;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : isoDay(parsed);
}

function pick({ currency, row, now }: RateDateInput): string | null {
  const today = isoDay(now);
  const custom = currency.customExchangeDate ?? today;
  if (currency.displayMode === "staticConverted" || currency.exchangeRateTiming === "custom") return custom;
  if (currency.exchangeRateTiming === "dateField") {
    return currency.dateFieldForConversion ? rowDate(row[currency.dateFieldForConversion]) : LATEST;
  }
  const period = currency.currencyTimePeriod;
  return period === "custom" ? custom : isoDay(PERIOD_DATE[period](now));
}

export interface RateDateInput {
  currency: CurrencySettings;
  row: Row;
  now: Date;
}

/**
 * The day whose rate converts this row: "YYYY-MM-DD", "latest", or null when no rate can exist
 * (unparsable date, or before the provider's first day). Future days ask for the latest rate.
 */
export function resolveRateDate(input: RateDateInput): string | null {
  const date = pick(input);
  if (date === null || date === LATEST) return date;
  if (date < MIN_RATE_DATE) return null;
  return date > isoDay(input.now) ? LATEST : date;
}

export type CustomDateProblem = "required" | "range";

/** The settings need a custom date (custom timing, custom period, or a fixed date) and it is missing or out of range. */
export function customDateProblem({ currency, now }: { currency: CurrencySettings; now: Date }): CustomDateProblem | null {
  const converts = currency.selectedCurrency !== SOURCE_CURRENCY && currency.displayMode !== "static";
  const pinned = currency.displayMode === "staticConverted" || currency.exchangeRateTiming === "custom";
  const customPeriod = currency.exchangeRateTiming === "timePeriod" && currency.currencyTimePeriod === "custom";
  if (!converts || !(pinned || customPeriod)) return null;
  const date = currency.customExchangeDate;
  if (!date) return "required";
  return date < MIN_RATE_DATE || date > isoDay(now) ? "range" : null;
}
