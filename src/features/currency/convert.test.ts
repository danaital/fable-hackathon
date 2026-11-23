import { describe, expect, it } from "vitest";
import type { FieldDef, Row } from "@/data/types";
import { DEFAULT_CURRENCY, DEFAULT_FORMATTING, type CurrencySettings } from "@/features/settings/schema";
import { createFormatters } from "@/lib/format";
import { convertAmount, convertRows, getConversion, rateKey, rateRequestsFor, summarizeCurrency, type RateTable } from "./convert";

const NOW = new Date("2026-03-04T12:00:00Z");
const rates: RateTable = new Map([
  [rateKey("USD", "2026-03-04"), { date: "2026-03-04", rates: { EUR: 0.9, ILS: 3.5 } }],
  [rateKey("ILS", "2026-03-04"), { date: "2026-03-04", rates: { EUR: 0.25 } }],
  [rateKey("USD", "2026-02-10"), { date: "2026-02-10", rates: { EUR: 0.8 } }],
  // Saturday: the provider answers with Friday's rate.
  [rateKey("USD", "2026-02-28"), { date: "2026-02-27", rates: { EUR: 0.85 } }],
]);
const fields: FieldDef[] = [
  { key: "amount", type: "currency", labelKey: "field.amount", currencyKey: "currency" },
  { key: "currency", type: "enum", labelKey: "field.currency" },
  { key: "orderDate", type: "date", labelKey: "field.orderDate" },
];
const eur = (patch: Partial<CurrencySettings> = {}): CurrencySettings => ({ ...DEFAULT_CURRENCY, selectedCurrency: "EUR", ...patch });

describe("convertAmount", () => {
  it("multiplies by the rate and reports the provider's rate date", () => {
    expect(convertAmount({ amount: 100, from: "USD", to: "EUR", rateDate: "2026-02-28", rates })).toEqual({
      value: 85, currency: "EUR", converted: true, missingRate: false, rate: 0.85, rateDate: "2026-02-27",
    });
  });
  it("short-circuits the same currency without needing a rate", () => {
    const result = convertAmount({ amount: 7, from: "EUR", to: "EUR", rateDate: null, rates: new Map() });
    expect(result).toMatchObject({ value: 7, currency: "EUR", converted: false, missingRate: false });
  });
  it("keeps the original value and currency when the rate is missing, never a wrong number", () => {
    const result = convertAmount({ amount: 50, from: "GBP", to: "EUR", rateDate: "2026-03-04", rates });
    expect(result).toMatchObject({ value: 50, currency: "GBP", converted: false, missingRate: true });
  });
  it("treats an unknown source code as a missing rate", () => {
    expect(convertAmount({ amount: 5, from: "XYZ", to: "EUR", rateDate: "2026-03-04", rates }).missingRate).toBe(true);
  });
  it("does not round: rounding happens only in the formatter", () => {
    const result = convertAmount({ amount: 10, from: "USD", to: "EUR", rateDate: "x", rates: new Map([[rateKey("USD", "x"), { date: "x", rates: { EUR: 0.333333 } }]]) });
    expect(result.value).toBeCloseTo(3.33333, 10);
    expect(createFormatters("en", DEFAULT_FORMATTING).currency(result.value, "EUR")).toBe("€3.33");
  });
  it("converts zero as a real amount", () => {
    expect(convertAmount({ amount: 0, from: "USD", to: "EUR", rateDate: "2026-03-04", rates })).toMatchObject({ value: 0, converted: true });
  });
});

const rows: Row[] = [
  { amount: 100, currency: "USD", orderDate: "2026-02-10" },
  { amount: 40, currency: "ILS", orderDate: "2026-02-10" },
  { amount: 5, currency: "EUR", orderDate: null },
  { amount: null, currency: "USD", orderDate: null },
];

describe("convertRows", () => {
  it("returns the same rows when amounts stay in their own currency", () => {
    expect(convertRows({ rows, fields, currency: DEFAULT_CURRENCY, rates, now: NOW })).toBe(rows);
    expect(convertRows({ rows, fields, currency: eur({ displayMode: "static" }), rates, now: NOW })).toBe(rows);
    expect(convertRows({ rows, fields, currency: eur(), now: NOW })).toBe(rows);
  });

  it("converts each amount and sets its currency column to the target", () => {
    const out = convertRows({ rows, fields, currency: eur(), rates, now: NOW });
    expect(out.map((r) => [r.amount, r.currency])).toEqual([[90, "EUR"], [10, "EUR"], [5, "EUR"], [null, "USD"]]);
    expect(getConversion(out[0], "amount")).toMatchObject({ original: 100, source: "USD", converted: true, rate: 0.9 });
    expect(rows[0].amount).toBe(100);
  });

  it("leaves a row in its own currency, flagged, when its rate is missing", () => {
    const out = convertRows({ rows, fields, currency: eur({ currencyTimePeriod: "yesterday" }), rates, now: NOW });
    expect(out[0]).toMatchObject({ amount: 100, currency: "USD" });
    expect(getConversion(out[0], "amount")?.missingRate).toBe(true);
    expect(out[2]).toMatchObject({ amount: 5, currency: "EUR" });
  });

  it("uses each row's own date with date-field timing", () => {
    const out = convertRows({ rows, fields, currency: eur({ exchangeRateTiming: "dateField", dateFieldForConversion: "orderDate" }), rates, now: NOW });
    expect(out[0].amount).toBe(80);
  });
});

describe("rateRequestsFor", () => {
  it("asks once per (base, date) and skips rows already in the target", () => {
    const many = [...rows, { amount: 1, currency: "USD", orderDate: "2026-02-10" }];
    expect(rateRequestsFor({ rows: many, fields, currency: eur(), now: NOW })).toEqual([
      { base: "USD", date: "2026-03-04" },
      { base: "ILS", date: "2026-03-04" },
    ]);
  });
  it("asks for nothing when no conversion is needed", () => {
    expect(rateRequestsFor({ rows, fields, currency: DEFAULT_CURRENCY, now: NOW })).toEqual([]);
  });
});

describe("summarizeCurrency", () => {
  const field = fields[0];
  it("totals rows that share one currency", () => {
    expect(summarizeCurrency({ rows: [rows[0], rows[3]], field })).toEqual({ status: "total", currency: "USD" });
  });
  it("refuses to total mixed currencies", () => {
    expect(summarizeCurrency({ rows, field })).toEqual({ status: "mixed", currencies: ["USD", "ILS", "EUR"] });
  });
  it("has no currency for no rows", () => expect(summarizeCurrency({ rows: [], field })).toEqual({ status: "total", currency: null }));
});
