import { describe, expect, it } from "vitest";
import { CALCULATORS, measure } from "./aggregate";
import { FIELDS, MIXED_ROWS, ROWS } from "./testRows";
import { SummaryNotice, applyConfigFilters } from "./values";

const cells = [2, 4, null, 9, "5", "n/a", ""];

describe("CALCULATORS", () => {
  it("count is the number of rows, blanks included", () => expect(CALCULATORS.count(cells)).toBe(7));
  it("unique ignores blanks", () => expect(CALCULATORS.unique([1, 1, "a", null, "", "a"])).toBe(2));
  it("sum treats a cell with no number as 0", () => expect(CALCULATORS.sum(cells)).toBe(20));
  it("average skips cells with no number", () => expect(CALCULATORS.average(cells)).toBe(5));
  it("averageRounded rounds the mean", () => expect(CALCULATORS.averageRounded([1, 2, 2, null])).toBe(2));
  it("median takes the middle, or the mean of the two middles", () => {
    expect(CALCULATORS.median([9, 1, 5, null])).toBe(5);
    expect(CALCULATORS.median([1, 2, 3, 10])).toBe(2.5);
  });
  it("minimum and maximum skip blanks", () => {
    expect(CALCULATORS.minimum(cells)).toBe(2);
    expect(CALCULATORS.maximum(cells)).toBe(9);
  });
  it("gives 0 when there is no number at all", () => {
    for (const kind of ["sum", "average", "averageRounded", "median", "minimum", "maximum"] as const) {
      expect(CALCULATORS[kind]([null, "", "x"])).toBe(0);
    }
  });
});

describe("measure", () => {
  it("counts rows without needing a field", () => {
    expect(measure({ rows: ROWS, calculation: "count", fields: FIELDS })).toEqual({ value: 5, unit: { type: "number" } });
  });
  it("gives 0 for any other calculation without a field", () => {
    expect(measure({ rows: ROWS, calculation: "sum", fields: FIELDS }).value).toBe(0);
  });
  it("carries the field's unit", () => {
    expect(measure({ rows: ROWS, calculation: "sum", key: "amount", fields: FIELDS })).toEqual({ value: 500, unit: { type: "currency", currency: "USD" } });
    expect(measure({ rows: ROWS, calculation: "maximum", key: "discountPct", fields: FIELDS }).unit).toEqual({ type: "percent" });
  });
  it("counts distinct values as a plain number, even on a currency field", () => {
    expect(measure({ rows: MIXED_ROWS, calculation: "unique", key: "amount", fields: FIELDS })).toEqual({ value: 3, unit: { type: "number" } });
  });
  it("refuses to total rows that mix currencies", () => {
    expect(() => measure({ rows: MIXED_ROWS, calculation: "sum", key: "amount", fields: FIELDS })).toThrow(SummaryNotice);
  });
  it("gives zero for zero rows", () => {
    expect(measure({ rows: [], calculation: "average", key: "items", fields: FIELDS }).value).toBe(0);
  });
});

describe("applyConfigFilters", () => {
  it("combines filters with AND and ignores filters without values", () => {
    const rows = applyConfigFilters(ROWS, [
      { field: "status", operator: "in", values: ["late", "delivered"] },
      { field: "express", operator: "in", values: [true] },
      { field: "agent", operator: "in", values: [] },
    ]);
    expect(rows).toHaveLength(2);
  });
  it("supports notIn and matches blanks by null", () => {
    expect(applyConfigFilters(ROWS, [{ field: "status", operator: "notIn", values: ["late"] }])).toHaveLength(3);
    expect(applyConfigFilters(ROWS, [{ field: "status", operator: "in", values: [null] }])).toHaveLength(1);
  });
  it("gives an empty set, not the original rows, when nothing matches", () => {
    expect(applyConfigFilters(ROWS, [{ field: "status", operator: "in", values: ["shipped"] }])).toEqual([]);
  });
});
