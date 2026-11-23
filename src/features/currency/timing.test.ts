import { describe, expect, it } from "vitest";
import { DEFAULT_CURRENCY, type CurrencySettings } from "@/features/settings/schema";
import { customDateProblem, resolveRateDate } from "./timing";

// Wednesday 2026-03-04, midday UTC.
const NOW = new Date("2026-03-04T12:00:00Z");
const MONDAY = new Date("2026-03-02T12:00:00Z");
const FRIDAY = new Date("2026-03-06T12:00:00Z");
const settings = (patch: Partial<CurrencySettings>): CurrencySettings => ({ ...DEFAULT_CURRENCY, selectedCurrency: "EUR", ...patch });
const resolve = (patch: Partial<CurrencySettings>, row = {}, now = NOW) => resolveRateDate({ currency: settings(patch), row, now });

describe("resolveRateDate: time period", () => {
  it("today is the current UTC day", () => expect(resolve({ currencyTimePeriod: "today" })).toBe("2026-03-04"));
  it("yesterday is one day back", () => expect(resolve({ currencyTimePeriod: "yesterday" })).toBe("2026-03-03"));
  it("this day last week is seven days back", () => expect(resolve({ currencyTimePeriod: "thisDayLastWeek" })).toBe("2026-02-25"));
  it("last trade day steps back over the weekend", () => {
    expect(resolve({ currencyTimePeriod: "lastTradeDay" }, {}, MONDAY)).toBe("2026-02-27");
    expect(resolve({ currencyTimePeriod: "lastTradeDay" })).toBe("2026-03-03");
  });
  it("next trade day is in the future, so it asks for the latest rate", () => {
    expect(resolve({ currencyTimePeriod: "nextTradeDay" }, {}, FRIDAY)).toBe("latest");
  });
  it("custom period uses the custom date, or today without one", () => {
    expect(resolve({ currencyTimePeriod: "custom", customExchangeDate: "2026-01-15" })).toBe("2026-01-15");
    expect(resolve({ currencyTimePeriod: "custom", customExchangeDate: null })).toBe("2026-03-04");
  });
});

describe("resolveRateDate: custom and pinned", () => {
  it("custom timing uses the custom date, or today without one", () => {
    expect(resolve({ exchangeRateTiming: "custom", customExchangeDate: "2025-12-31" })).toBe("2025-12-31");
    expect(resolve({ exchangeRateTiming: "custom", customExchangeDate: null })).toBe("2026-03-04");
  });
  it("staticConverted pins every row to the custom date whatever the timing", () => {
    expect(resolve({ displayMode: "staticConverted", exchangeRateTiming: "dateField", customExchangeDate: "2026-02-02" })).toBe("2026-02-02");
  });
});

describe("resolveRateDate: date field", () => {
  const dateField = { exchangeRateTiming: "dateField", dateFieldForConversion: "orderDate" } as const;
  it("reads the row's date", () => expect(resolve(dateField, { orderDate: "2026-02-10" })).toBe("2026-02-10"));
  it("takes the UTC day of a date-time", () =>
    expect(resolve({ ...dateField, dateFieldForConversion: "paidAt" }, { paidAt: "2026-02-10T23:30:00.000Z" })).toBe("2026-02-10"));
  it("empty cell or no field configured asks for the latest rate", () => {
    expect(resolve(dateField, { orderDate: null })).toBe("latest");
    expect(resolve({ ...dateField, dateFieldForConversion: null }, { orderDate: "2026-02-10" })).toBe("latest");
  });
  it("an unparsable date is a failure, not today's rate", () => expect(resolve(dateField, { orderDate: "soon" })).toBeNull());
  it("a date before the provider's first day has no rate", () => expect(resolve(dateField, { orderDate: "1990-05-01" })).toBeNull());
});

describe("customDateProblem", () => {
  const problem = (patch: Partial<CurrencySettings>) => customDateProblem({ currency: settings(patch), now: NOW });
  it("needs a date for custom timing, custom period and a fixed date", () => {
    expect(problem({ exchangeRateTiming: "custom" })).toBe("required");
    expect(problem({ currencyTimePeriod: "custom" })).toBe("required");
    expect(problem({ displayMode: "staticConverted" })).toBe("required");
  });
  it("rejects a future or pre-1999 date", () => {
    expect(problem({ exchangeRateTiming: "custom", customExchangeDate: "2026-03-05" })).toBe("range");
    expect(problem({ exchangeRateTiming: "custom", customExchangeDate: "1998-12-31" })).toBe("range");
    expect(problem({ exchangeRateTiming: "custom", customExchangeDate: "2026-03-04" })).toBeNull();
  });
  it("needs nothing when amounts are not converted or timing is a moving period", () => {
    expect(problem({ selectedCurrency: "row", exchangeRateTiming: "custom" })).toBeNull();
    expect(problem({ displayMode: "static", exchangeRateTiming: "custom" })).toBeNull();
    expect(problem({ currencyTimePeriod: "today" })).toBeNull();
  });
});
