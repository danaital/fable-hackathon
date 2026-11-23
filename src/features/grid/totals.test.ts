import { describe, expect, it } from "vitest";
import type { FieldDef, Row } from "@/data/types";
import { computeTotal, defaultTotals, labelColumn, totalKinds, totalOptions, type TotalKind } from "./totals";

const amount: FieldDef = { key: "amount", type: "currency", labelKey: "field.amount", currencyKey: "currency" };
const items: FieldDef = { key: "items", type: "number", labelKey: "field.items" };
const date: FieldDef = { key: "date", type: "date", labelKey: "field.orderDate" };
const express: FieldDef = { key: "express", type: "boolean", labelKey: "field.express" };
const status: FieldDef = { key: "status", type: "status", labelKey: "field.status" };

const rows: Row[] = [
  { amount: 10, currency: "USD", items: 1, date: "2026-11-20", express: true, status: "late" },
  { amount: 30, currency: "USD", items: 2, date: "2026-11-23", express: false, status: "late" },
  { amount: null, currency: "USD", items: 2, date: null, express: null, status: "" },
  { amount: 20, currency: "USD", items: 7, date: "2026-12-01", express: true, status: "shipped" },
];
const now = new Date(2026, 10, 23, 15, 0);
const total = (field: FieldDef, kind: TotalKind, list: Row[] = rows) => computeTotal({ rows: list, field, kind, now });
const value = (field: FieldDef, kind: TotalKind) => {
  const result = total(field, kind);
  return "value" in result ? result.value : result.as;
};

describe("totalOptions", () => {
  it("offers calculations by field type", () => {
    expect(totalOptions("currency")).toContain("sum");
    expect(totalOptions("date")).toEqual(expect.arrayContaining(["min", "max", "dateRangeDays", "countToday"]));
    expect(totalOptions("boolean")).toContain("countTrue");
    expect(totalOptions("status")).toContain("mostCommon");
    expect(totalOptions("string")).not.toContain("sum");
    expect(totalOptions("email")).toEqual(["count", "uniqueCount", "first", "last", "mostCommon"]);
  });
});

describe("computeTotal", () => {
  it("calculates the numeric kinds, leaving missing values out", () => {
    expect(value(amount, "sum")).toBe(60);
    expect(value(amount, "avg")).toBe(20);
    expect(value(amount, "count")).toBe(4);
    expect(value(amount, "min")).toBe(10);
    expect(value(amount, "max")).toBe(30);
    expect(value(amount, "median")).toBe(20);
    expect(value(amount, "range")).toBe(20);
    expect(value(amount, "variance")).toBeCloseTo(66.667, 2);
    expect(value(amount, "stdDev")).toBeCloseTo(8.165, 2);
    expect(value(amount, "p25")).toBe(15);
    expect(value(amount, "p90")).toBe(28);
    expect(value(items, "mode")).toBe(2);
    expect(value(items, "uniqueCount")).toBe(3);
    expect(value(items, "first")).toBe(1);
    expect(value(items, "last")).toBe(7);
  });

  it("keeps the currency with a money result", () => {
    expect(total(amount, "sum")).toEqual({ as: "field", value: 60, currency: "USD" });
  });

  it("refuses to add or rank amounts in several currencies, but still counts them", () => {
    const mixed: Row[] = [...rows, { amount: 5, currency: "EUR" }];
    expect(total(amount, "sum", mixed)).toEqual({ as: "mixed" });
    expect(total(amount, "max", mixed)).toEqual({ as: "mixed" });
    expect(total(amount, "count", mixed)).toEqual({ as: "number", value: 5 });
    expect(total(amount, "last", mixed)).toEqual({ as: "field", value: 5, currency: "EUR" });
  });

  it("ignores the currency of rows that have no amount", () => {
    expect(total(amount, "sum", [...rows, { amount: null, currency: "EUR" }])).toEqual({ as: "field", value: 60, currency: "USD" });
  });

  it("calculates the date kinds against today", () => {
    expect(value(date, "min")).toBe("2026-11-20");
    expect(value(date, "max")).toBe("2026-12-01");
    expect(total(date, "dateRangeDays")).toEqual({ as: "days", value: 11 });
    expect(value(date, "countToday")).toBe(1);
    expect(value(date, "countPast")).toBe(1);
    expect(value(date, "countFuture")).toBe(1);
  });

  it("calculates the boolean kinds", () => {
    expect(value(express, "countTrue")).toBe(2);
    expect(value(express, "countFalse")).toBe(1);
    expect(total(express, "percentTrue").as).toBe("percent");
    expect(value(express, "percentTrue")).toBe(50);
    expect(total(express, "countTrue", [{ express: "true" }, { express: 1 }, { express: "0" }])).toEqual({ as: "number", value: 2 });
  });

  it("calculates the text kinds, treating a blank as missing", () => {
    expect(value(status, "mostCommon")).toBe("late");
    expect(value(status, "leastCommon")).toBe("shipped");
    expect(value(status, "count")).toBe(4);
    expect(value(status, "uniqueCount")).toBe(2);
    expect(total(status, "concat")).toEqual({ as: "list", values: ["late", "shipped"], more: 0 });
  });

  it("returns an empty result, not zero or NaN, when there is nothing to calculate", () => {
    expect(total(amount, "avg", [])).toEqual({ as: "empty" });
    expect(total(amount, "sum", [{ amount: null }])).toEqual({ as: "empty" });
    expect(total(date, "max", [])).toEqual({ as: "empty" });
    expect(total(amount, "count", [])).toEqual({ as: "number", value: 0 });
  });
});

describe("totalKinds and labelColumn", () => {
  const fields = [status, amount, items];

  it("defaults to a count in the first column and a sum for amounts and numbers", () => {
    expect(defaultTotals([status, amount, items, date, express])).toEqual({ status: "count", amount: "sum", items: "sum" });
  });

  it("lets the grid's own choice win and ignores a calculation the type does not offer", () => {
    const kinds = totalKinds({ fields, totals: { amount: "sum", status: "sum", items: "max" }, extra: { items: "median" } });
    expect(kinds).toEqual({ amount: "sum", items: "median" });
  });

  it("puts the label in the first column without a calculation", () => {
    expect(labelColumn(fields, { amount: "sum" })).toBe(0);
    expect(labelColumn(fields, { status: "count" })).toBe(1);
    expect(labelColumn(fields, { status: "count", amount: "sum", items: "sum" })).toBe(-1);
  });
});
