import type { DateFormat, DatetimeStructure, FormattingSettings, TimeFormat } from "@/features/settings/schema";
import type { Locale } from "@/lib/prefs";

const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", he: "he-IL" };
const DEFAULT_CURRENCY = "USD";
/** Shown for a date that cannot be parsed. */
export const INVALID_DATE = "--";

export interface Formatters {
  number: (value: number) => string;
  percent: (value: number) => string;
  currency: (value: number, code?: string) => string;
  date: (iso: string) => string;
  dateTime: (iso: string) => string;
  country: (code: string) => string;
}

/** Caches one Intl.NumberFormat per key; a bad currency code degrades to "CODE number" instead of throwing. */
function numberCache(tag: string) {
  const cache = new Map<string, Intl.NumberFormat>();
  return (key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat | null => {
    if (!cache.has(key)) {
      try {
        cache.set(key, new Intl.NumberFormat(tag, options));
      } catch {
        return null;
      }
    }
    return cache.get(key) ?? null;
  };
}

/**
 * Formatters for a locale. Without `formatting` the output is the original fixed style (kept for existing callers);
 * with it, dates, times and decimal places follow the user's settings.
 */
export function createFormatters(locale: Locale, formatting?: FormattingSettings): Formatters {
  const tag = INTL_LOCALE[locale];
  const regions = new Intl.DisplayNames([tag], { type: "region" });
  const country = (code: string) => regions.of(code) ?? code;
  return formatting ? settingsFormatters({ tag, formatting, country }) : legacyFormatters(tag, country);
}

function legacyFormatters(tag: string, country: (code: string) => string): Formatters {
  const number = new Intl.NumberFormat(tag, { maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(tag, { dateStyle: "medium" });
  const dateTime = new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short" });
  const get = numberCache(tag);
  return {
    number: (value) => number.format(value),
    // Percent values are stored as whole numbers (15 means 15%).
    percent: (value) => percent.format(value / 100),
    currency: (value, code = DEFAULT_CURRENCY) =>
      get(code, { style: "currency", currency: code })?.format(value) ?? `${code} ${number.format(value)}`,
    date: (iso) => date.format(new Date(iso)),
    dateTime: (iso) => dateTime.format(new Date(iso)),
    country,
  };
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TOKENS = /YYYY|YY|MMM|MM|DD/g;
const MONTH_NAME_TOKEN = "MMM";
const PATTERN_DELIMITER = ".";
const TWO_DIGITS = 2;
const HOURS_PER_HALF_DAY = 12;

const pad = (value: number) => String(value).padStart(TWO_DIGITS, "0");

/** Date-only text is a calendar day in local time; anything else is a moment shown in local time. */
function parseDate(iso: string): Date | null {
  const day = DATE_ONLY.exec(iso);
  const parsed = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(iso.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const JOIN: Record<DatetimeStructure, (date: string, time: string) => string> = {
  date_time_space: (date, time) => `${date} ${time}`,
  date_time_comma: (date, time) => `${date}, ${time}`,
  time_date_space: (date, time) => `${time} ${date}`,
  time_date_comma: (date, time) => `${time}, ${date}`,
};

interface SettingsInput {
  tag: string;
  formatting: FormattingSettings;
  country: (code: string) => string;
}

function settingsFormatters({ tag, formatting, country }: SettingsInput): Formatters {
  const get = numberCache(tag);
  const monthName = new Intl.DateTimeFormat(tag, { month: "short" });
  const dayPeriod = new Intl.DateTimeFormat(tag, { hour: "numeric", hour12: true });

  // Whole numbers show no decimals; any other number shows exactly `digits`. Rounded-to-zero is never negative.
  const decimals = (value: number, digits: number, options: Intl.NumberFormatOptions = {}) => {
    const fraction = Number.isInteger(value) ? 0 : digits;
    const key = `${JSON.stringify(options)}|${fraction}`;
    return get(key, { ...options, minimumFractionDigits: fraction, maximumFractionDigits: fraction, signDisplay: "negative" });
  };
  const number = (value: number) => decimals(value, formatting.maxDigitsForNumbers)?.format(value) ?? String(value);

  const formatDate = (date: Date, pattern: DateFormat) => {
    const parts: Record<string, string> = {
      YYYY: String(date.getFullYear()),
      YY: String(date.getFullYear()).slice(-TWO_DIGITS),
      MMM: monthName.format(date),
      MM: pad(date.getMonth() + 1),
      DD: pad(date.getDate()),
    };
    const withDelimiter = pattern.includes(MONTH_NAME_TOKEN) ? pattern : pattern.split(PATTERN_DELIMITER).join(formatting.dateDelimiter);
    return withDelimiter.replace(DATE_TOKENS, (token) => parts[token]);
  };

  const period = (date: Date) => dayPeriod.formatToParts(date).find((part) => part.type === "dayPeriod")?.value ?? "";
  const hour12 = (date: Date) => date.getHours() % HOURS_PER_HALF_DAY || HOURS_PER_HALF_DAY;
  const TIME: Record<TimeFormat, (date: Date) => string> = {
    "HH:mm": (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    "h:mm A": (date) => `${hour12(date)}:${pad(date.getMinutes())} ${period(date)}`,
    "hh:mm A": (date) => `${pad(hour12(date))}:${pad(date.getMinutes())} ${period(date)}`,
  };

  return {
    number,
    // Percent values are stored as whole numbers (15 means 15%).
    percent: (value) => decimals(value, formatting.maxDigitsForPercent, { style: "percent" })?.format(value / 100) ?? `${number(value)}%`,
    currency: (value, code = DEFAULT_CURRENCY) =>
      decimals(value, formatting.maxDigitsForCurrency, { style: "currency", currency: code })?.format(value) ?? `${code} ${number(value)}`,
    date: (iso) => {
      const date = parseDate(iso);
      return date ? formatDate(date, formatting.dateFormat) : INVALID_DATE;
    },
    dateTime: (iso) => {
      const date = parseDate(iso);
      return date ? JOIN[formatting.datetimeStructure](formatDate(date, formatting.dateFormat), TIME[formatting.timeFormat](date)) : INVALID_DATE;
    },
    country,
  };
}
