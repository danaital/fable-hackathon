/** Shared by the /api/rates route and the browser: codes, dates and limits for exchange rates. */

/** ISO codes the rate provider (Frankfurter v1, ECB data) publishes; the route rejects anything else. */
export const RATE_CURRENCIES = [
  "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD",
  "HUF", "IDR", "ILS", "INR", "ISK", "JPY", "KRW", "MXN", "MYR", "NOK",
  "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB", "TRY", "USD", "ZAR",
] as const;
export type RateCurrency = (typeof RATE_CURRENCIES)[number];

export function isRateCurrency(code: unknown): code is RateCurrency {
  return typeof code === "string" && (RATE_CURRENCIES as readonly string[]).includes(code);
}

/** The provider's most recent working day. */
export const LATEST = "latest";
/** First day the provider has rates for. */
export const MIN_RATE_DATE = "1999-01-04";
/** Dates per /api/rates request; the browser splits longer lists. */
export const MAX_DATES_PER_REQUEST = 100;

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = 10;

/** UTC calendar day, the provider's own date basis. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

/** A real calendar day in YYYY-MM-DD (rejects 2026-02-30). */
export function isValidIsoDay(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && isoDay(parsed) === value;
}
