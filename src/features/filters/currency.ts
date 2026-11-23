import type { FieldDef, Row } from "@/data/types";
import { isRateCurrency } from "@/features/currency/codes";
import { convertAmount, rateKey, type RateRequest, type RateTable } from "@/features/currency/convert";
import { resolveRateDate } from "@/features/currency/timing";
import type { CurrencySettings } from "@/features/settings/schema";
import { isBlank, type FilterSpec } from "./operators";

/**
 * CURRENCY HOOK. Everything the filters need from the currency feature goes through this file
 * (and useFilterRates.ts, which fetches): the engine reads rates only in this shape.
 */
export interface FilterRates {
  table: RateTable;
  /** The day whose rate applies to a row ("YYYY-MM-DD" or "latest"), or `null` when no rate can exist. */
  dateFor: (row: Row) => string | null;
}

/** True when the rule's amount is typed in its own currency and must be converted per row. */
export const usesRates = (rule: FilterSpec, field: FieldDef): boolean => field.type === "currency" && !isBlank(rule.currency?.targetCurrency);

interface ConvertFilterAmountInput {
  amount: number;
  from: string;
  to: string;
  date: string | null;
  rates: FilterRates;
}

/** The amount in another currency, or `null` when a rate is missing (the engine then keeps the row). */
export function convertFilterAmount({ amount, from, to, date, rates }: ConvertFilterAmountInput): number | null {
  if (from === to) return amount;
  const result = convertAmount({ amount, from, to, rateDate: date, rates: rates.table });
  return result.missingRate ? null : result.value;
}

const rowCurrency = (row: Row, field: FieldDef): string | null => {
  const code = field.currencyKey ? row[field.currencyKey] : null;
  return typeof code === "string" && code !== "" ? code : null;
};

interface UnconvertedInput {
  rows: readonly Row[];
  field: FieldDef;
  /** The currency the filter value is typed in. */
  currency: string;
  rates: FilterRates;
}

/** How many rows a converted amount filter could not judge (and so kept), for the warning on its card. */
export function countUnconverted({ rows, field, currency, rates }: UnconvertedInput): number {
  return rows.filter((row) => {
    const to = rowCurrency(row, field);
    return to !== null && convertFilterAmount({ amount: 1, from: currency, to, date: rates.dateFor(row), rates }) === null;
  }).length;
}

interface RateRequestsInput {
  rows: readonly Row[];
  fields: readonly FieldDef[];
  filters: readonly FilterSpec[];
  currency: CurrencySettings;
  now: Date;
}

/** Every (filter currency, row rate date) the amount filters need, once each. */
export function filterRateRequests({ rows, fields, filters, currency, now }: RateRequestsInput): RateRequest[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const requests = new Map<string, RateRequest>();
  for (const rule of filters) {
    const field = byKey.get(rule.field);
    const base = rule.currency?.targetCurrency;
    if (!field || !usesRates(rule, field) || !isRateCurrency(base)) continue;
    for (const row of rows) {
      const date = resolveRateDate({ currency, row, now });
      if (date !== null && rowCurrency(row, field) !== base) requests.set(rateKey(base, date), { base, date });
    }
  }
  return [...requests.values()];
}
