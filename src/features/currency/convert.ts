import type { CellValue, FieldDef, Row } from "@/data/types";
import { SOURCE_CURRENCY, type CurrencySettings } from "@/features/settings/schema";
import { isRateCurrency, type RateCurrency } from "./codes";
import { resolveRateDate } from "./timing";

/** One provider answer: the day it actually used (weekends fall back to Friday) and quote rates per code. */
export interface RateEntry {
  date: string;
  rates: Partial<Record<string, number>>;
}
/** Rates keyed by rateKey(base, requested date). */
export type RateTable = ReadonlyMap<string, RateEntry>;
export interface RateRequest {
  base: RateCurrency;
  /** "YYYY-MM-DD" or "latest". */
  date: string;
}

export const rateKey = (base: string, date: string) => `${base}|${date}`;

export interface AmountConversion {
  value: number;
  currency: string;
  /** A rate was applied (false for same currency, no target, or a missing rate). */
  converted: boolean;
  /** A conversion was wanted but no rate exists: value and currency are the originals. */
  missingRate: boolean;
  rate: number | null;
  /** The day the provider's rate is from. */
  rateDate: string | null;
}

export interface ConvertAmountInput {
  amount: number;
  from: string;
  to: string;
  rateDate: string | null;
  rates: RateTable;
}

/** Converts one amount. Never throws: without a rate it returns the original amount, flagged. */
export function convertAmount({ amount, from, to, rateDate, rates }: ConvertAmountInput): AmountConversion {
  const original = { value: amount, currency: from, converted: false, missingRate: false, rate: null, rateDate: null };
  if (from === to) return original;
  const entry = isRateCurrency(from) && rateDate !== null ? rates.get(rateKey(from, rateDate)) : undefined;
  const rate = entry?.rates[to];
  if (!entry || rate === undefined) return { ...original, missingRate: true };
  // No rounding here: rounding happens only when the value is formatted.
  return { value: amount * rate, currency: to, converted: true, missingRate: false, rate, rateDate: entry.date };
}

/** The code amounts are shown in, or null when every row stays in its own currency. */
export function targetCurrency(currency: CurrencySettings): string | null {
  return currency.selectedCurrency === SOURCE_CURRENCY || currency.displayMode === "static" ? null : currency.selectedCurrency;
}

export function parseAmount(value: CellValue | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const moneyFields = (fields: readonly FieldDef[]) => fields.filter((field) => field.type === "currency" && field.currencyKey);

export interface RowsInput {
  rows: readonly Row[];
  fields: readonly FieldDef[];
  currency: CurrencySettings;
  /** "Now" for moving rate periods; injectable so tests are stable. */
  now?: Date;
}

/** Every (base, date) rate the rows need under these settings, once each. */
export function rateRequestsFor({ rows, fields, currency, now = new Date() }: RowsInput): RateRequest[] {
  const to = targetCurrency(currency);
  if (!to) return [];
  const requests = new Map<string, RateRequest>();
  for (const row of rows) {
    for (const field of moneyFields(fields)) {
      const from = row[field.currencyKey ?? ""];
      if (!isRateCurrency(from) || from === to) continue;
      const date = resolveRateDate({ currency, row, now });
      if (date !== null) requests.set(rateKey(from, date), { base: from, date });
    }
  }
  return [...requests.values()];
}

/** A converted cell's details: the conversion plus the amount and currency it started from. */
export type RowConversion = AmountConversion & { original: number; source: string };

// Side table so converted rows keep the Row shape; keyed by the new row objects convertRows returns.
const conversions = new WeakMap<Row, Readonly<Record<string, RowConversion>>>();

/** How convertRows produced this row's value for a currency field, if it touched it. */
export function getConversion(row: Row, fieldKey: string): RowConversion | undefined {
  return conversions.get(row)?.[fieldKey];
}

export interface ConvertRowsInput extends RowsInput {
  /** Rates from useCurrency() or useRates(). Without them rows are returned unchanged. */
  rates?: RateTable;
}

/**
 * Converts every currency field into the target currency and sets its currency column to the target.
 * A row whose rate is missing keeps its original amount and currency (see getConversion for the flag).
 * Returns the input array itself when nothing converts, so memoized consumers do not re-run.
 */
export function convertRows({ rows, fields, currency, rates, now = new Date() }: ConvertRowsInput): readonly Row[] {
  const to = targetCurrency(currency);
  const money = moneyFields(fields);
  if (!to || !rates || money.length === 0) return rows;

  const byCodeColumn = new Map<string, FieldDef[]>();
  for (const field of money) {
    const key = field.currencyKey ?? "";
    byCodeColumn.set(key, [...(byCodeColumn.get(key) ?? []), field]);
  }
  return rows.map((row) => {
    const next: Row = { ...row };
    const details: Record<string, RowConversion> = {};
    for (const [codeKey, group] of byCodeColumn) {
      const from = row[codeKey];
      if (typeof from !== "string") continue;
      const rateDate = resolveRateDate({ currency, row, now });
      const results = group.map((field) => {
        const amount = parseAmount(row[field.key]);
        return amount === null ? null : { field, amount, result: convertAmount({ amount, from, to, rateDate, rates }) };
      });
      // Fields sharing one currency column convert together, or not at all, so value and code never disagree.
      const complete = results.every((item) => !item?.result.missingRate);
      for (const item of results) {
        if (!item) continue;
        details[item.field.key] = { ...item.result, ...(complete ? {} : { value: item.amount, currency: from }), original: item.amount, source: from };
        if (complete) next[item.field.key] = item.result.value;
      }
      if (complete && results.some(Boolean)) next[codeKey] = to;
    }
    conversions.set(next, details);
    return next;
  });
}

export type CurrencySummary = { status: "total"; currency: string | null } | { status: "mixed"; currencies: string[] };

/** Whether rows can be totalled for a currency field: one currency gives a total, several are "mixed". */
export function summarizeCurrency({ rows, field }: { rows: readonly Row[]; field: FieldDef }): CurrencySummary {
  const codes = new Set<string>();
  for (const row of rows) {
    const code = row[field.currencyKey ?? ""];
    if (typeof code === "string" && parseAmount(row[field.key]) !== null) codes.add(code);
  }
  const currencies = [...codes];
  return currencies.length > 1 ? { status: "mixed", currencies } : { status: "total", currency: currencies[0] ?? null };
}
