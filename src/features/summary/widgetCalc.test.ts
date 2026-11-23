import { describe, expect, it } from "vitest";
import { summaryConfigSchema, type SummaryConfigInput, type WidgetConfig } from "./config";
import { FIELDS, MIXED_ROWS, NOW, ROWS } from "./testRows";
import { calculateWidget } from "./widgetCalc";

type WidgetInput = SummaryConfigInput["widgets"][number];
type Body = WidgetInput extends infer W ? (W extends unknown ? Omit<W, "id" | "title"> : never) : never;

const title = { en: "Title", he: "כותרת" };
const widget = (config: Body): WidgetConfig => summaryConfigSchema.parse({ widgets: [{ id: "w", title, ...config }], charts: [] }).widgets[0];
const calculate = (config: Body, rows = ROWS) => calculateWidget({ widget: widget(config), rows, fields: FIELDS, now: NOW });
const value = (config: Body, rows = ROWS) => {
  const result = calculate(config, rows);
  return result.kind === "value" ? result.measure.value : result.kind;
};

describe("basic calculation", () => {
  it("defaults to a row count", () => expect(value({ type: "basicCalculation" })).toBe(5));
  it("runs every calculation kind over the field", () => {
    expect(value({ type: "basicCalculation", calculation: "unique", field: "agent" })).toBe(2);
    expect(value({ type: "basicCalculation", calculation: "sum", field: "items" })).toBe(20);
    expect(value({ type: "basicCalculation", calculation: "average", field: "items" })).toBe(5);
    expect(value({ type: "basicCalculation", calculation: "averageRounded", field: "discountPct" })).toBe(8);
    expect(value({ type: "basicCalculation", calculation: "median", field: "items" })).toBe(4.5);
    expect(value({ type: "basicCalculation", calculation: "minimum", field: "items" })).toBe(2);
    expect(value({ type: "basicCalculation", calculation: "maximum", field: "items" })).toBe(9);
  });
  it("gives 0 for a calculation that needs a field and has none", () => {
    expect(value({ type: "basicCalculation", calculation: "sum" })).toBe(0);
  });
  it("applies widget filters first, and gives zero when nothing matches", () => {
    expect(value({ type: "basicCalculation", calculation: "sum", field: "amount", filters: [{ field: "status", values: ["delivered"] }] })).toBe(400);
    expect(value({ type: "basicCalculation", filters: [{ field: "status", values: ["shipped"] }] })).toBe(0);
  });
  it("gives zeros for zero rows", () => {
    expect(value({ type: "basicCalculation", calculation: "average", field: "items" }, [])).toBe(0);
  });
  it("averages per-group averages when grouped, so each group counts once", () => {
    // Noa (2 + 4) / 2 = 3, Amir 9, no agent 5.
    expect(value({ type: "basicCalculation", calculation: "average", field: "items", groupByField: "agent" })).toBeCloseTo(17 / 3);
  });
  it("shows a notice instead of a total when rows mix currencies", () => {
    expect(calculate({ type: "basicCalculation", calculation: "sum", field: "amount" }, MIXED_ROWS)).toEqual({ kind: "notice", code: "mixedCurrency", detail: "EUR, USD" });
    expect(value({ type: "basicCalculation", calculation: "sum", field: "amount", filters: [{ field: "currency", values: ["USD"] }] }, MIXED_ROWS)).toBe(400);
  });
});

describe("custom (simple)", () => {
  it("sums by default and rounds an average to one decimal", () => {
    expect(value({ type: "custom", field: "amount" })).toBe(500);
    expect(value({ type: "custom", field: "discountPct", aggregation: "average" })).toBe(7.5);
    expect(value({ type: "custom", field: "items", aggregation: "max" })).toBe(9);
    expect(value({ type: "custom", field: "items", aggregation: "count" })).toBe(5);
  });
  it("turns mixed currencies into a notice", () => {
    expect(calculate({ type: "custom", field: "amount" }, MIXED_ROWS).kind).toBe("notice");
  });
});

describe("dual value", () => {
  it("calculates each side with its own filters, field and calculation", () => {
    const result = calculate({
      type: "dualValue",
      filters: [{ field: "express", values: [false] }],
      left: { title, filters: [{ field: "status", values: ["delivered"] }] },
      right: { title, field: "amount", calculation: "sum" },
    });
    expect(result).toMatchObject({ kind: "dual", left: { value: 1 }, right: { value: 400, unit: { type: "currency", currency: "USD" } } });
  });
});

describe("comparison", () => {
  const base = { type: "comparison" as const, dateField: "orderDate" };

  it("compares the current window with the previous one", () => {
    // Last 30 days from 23 Nov: 25 Oct to 23 Nov holds two rows; the 30 days before hold two more.
    const result = calculate({ ...base, currentPeriod: { type: "last_30_days" }, operation: "sum", field: "amount" });
    expect(result).toMatchObject({
      kind: "comparison",
      current: { value: 400 },
      previous: { value: 50 },
      trendPct: 700,
      direction: "up",
      windows: { current: { start: "2026-10-25", end: "2026-11-23" }, previous: { start: "2026-09-25", end: "2026-10-24" } },
    });
  });
  it("reports a fall and an exact tie", () => {
    const fall = calculate({ ...base, currentPeriod: { start: "2026-10-01", end: "2026-10-31" }, previousPeriod: { start: "2026-11-01", end: "2026-11-30" }, operation: "sum", field: "amount" });
    expect(fall).toMatchObject({ current: { value: 50 }, previous: { value: 400 }, trendPct: 87.5, direction: "down" });
    const tie = calculate({ ...base, currentPeriod: { type: "month_to_date" }, previousPeriod: { relationship: "previous_period" } });
    expect(tie).toMatchObject({ current: { value: 2 }, previous: { value: 2 }, trendPct: 0, direction: "flat" });
  });
  it("gives a 0% trend when the previous value is 0, with the direction still from the raw values", () => {
    const result = calculate({ ...base, currentPeriod: { type: "month_to_date" }, previousPeriod: { relationship: "same_period_last_year" } });
    expect(result).toMatchObject({ current: { value: 2 }, previous: { value: 0 }, trendPct: 0, direction: "up" });
  });
  it("defaults to year to date", () => {
    expect(calculate(base)).toMatchObject({ current: { value: 4 }, windows: { current: { start: "2026-01-01", end: "2026-11-23" } } });
  });
  it("lets the window replace a widget filter on the date field and keeps the other filters", () => {
    const result = calculate({
      ...base,
      currentPeriod: { type: "last_30_days" },
      filters: [
        { field: "orderDate", values: ["2020-01-01"] },
        { field: "express", values: [true] },
      ],
    });
    expect(result).toMatchObject({ current: { value: 1 }, previous: { value: 1 } });
  });
});

describe("ranking", () => {
  it("returns the full ranked list and its summary", () => {
    const result = calculate({ type: "ranking", labelField: "agent", field: "items", calculation: "sum", showShare: true });
    expect(result).toMatchObject({ kind: "ranking", ranking: { summary: "total", summaryValue: 20, rows: [{ key: "Amir", position: 1, share: 0.45 }, { key: "Noa" }, { key: null }] } });
  });
});

describe("failure isolation", () => {
  it("returns an error result instead of throwing", () => {
    const broken = { ...widget({ type: "basicCalculation", field: "items" }), calculation: "nope" } as unknown as WidgetConfig;
    expect(calculateWidget({ widget: broken, rows: ROWS, fields: FIELDS, now: NOW })).toEqual({ kind: "error" });
  });
});
