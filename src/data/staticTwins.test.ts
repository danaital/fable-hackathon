import { describe, expect, it } from "vitest";
import { convertRows } from "@/features/currency/convert";
import { DEFAULT_CURRENCY } from "@/features/settings/schema";
import { REPORTS } from "./reports";
import { addStaticValues, withStaticTwins } from "./staticTwins";
import type { FieldDef } from "./types";

const fields: FieldDef[] = [
  { key: "orderId", type: "string", labelKey: "field.orderId" },
  { key: "amount", type: "currency", labelKey: "field.amount", currencyKey: "currency" },
  { key: "currency", type: "enum", labelKey: "field.currency" },
];

describe("static twins", () => {
  it("adds one static twin right after each convertible money field", () => {
    const keys = withStaticTwins(fields).map((field) => field.key);
    expect(keys).toEqual(["orderId", "amount", "amountStatic", "currency"]);
    expect(withStaticTwins(withStaticTwins(fields)).map((field) => field.key)).toEqual(keys);
  });

  it("gives every convertible money field in every report a twin", () => {
    for (const report of REPORTS) {
      const money = report.fields.filter((field) => field.type === "currency" && !field.static);
      for (const field of money) expect(report.fields.some((twin) => twin.key === `${field.key}Static` && twin.static), `${report.id}.${field.key}`).toBe(true);
    }
  });

  it("keeps the twin in the row's own currency when the amount is converted", () => {
    const withTwins = withStaticTwins(fields);
    const rows = addStaticValues([{ orderId: "A-1", amount: 100, currency: "EUR" }], withTwins);
    const rates = new Map([["EUR|2026-01-02", { date: "2026-01-02", rates: { USD: 2 } }]]);
    const currency = { ...DEFAULT_CURRENCY, selectedCurrency: "USD" as const, exchangeRateTiming: "custom" as const, customExchangeDate: "2026-01-02" };
    const [converted] = convertRows({ rows, fields: withTwins, currency, rates });
    expect(converted).toMatchObject({ amount: 200, currency: "USD", amountStatic: 100, amountStaticCurrency: "EUR" });
  });
});
