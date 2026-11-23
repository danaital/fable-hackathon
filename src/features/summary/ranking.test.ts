import { describe, expect, it } from "vitest";
import { rank } from "./ranking";
import { FIELDS, MIXED_ROWS, ROWS } from "./testRows";
import { SummaryNotice } from "./values";

describe("rank", () => {
  it("groups by label, sorts by value and numbers positions from 1", () => {
    const { rows } = rank({ rows: ROWS, labelKey: "agent", valueKey: "items", calculation: "sum", fields: FIELDS });
    expect(rows.map(({ key, value, position }) => [key, value, position])).toEqual([
      ["Amir", 9, 1],
      ["Noa", 6, 2],
      [null, 5, 3],
    ]);
  });
  it("files blank labels under the Unknown group (null key)", () => {
    const { rows } = rank({ rows: ROWS, labelKey: "status", fields: FIELDS });
    expect(rows.find((row) => row.key === null)?.value).toBe(1);
  });
  it("ranks by row count when no value field is given", () => {
    const result = rank({ rows: ROWS, labelKey: "agent", fields: FIELDS, showShare: true });
    expect(result.rows.map((row) => row.value)).toEqual([2, 2, 1]);
    expect(result.summary).toBe("total");
    expect(result.summaryValue).toBe(5);
    expect(result.rows[0].share).toBe(0.4);
  });
  it("defaults to sum for a currency field and average for any other", () => {
    expect(rank({ rows: ROWS, labelKey: "agent", valueKey: "amount", fields: FIELDS }).rows[0]).toMatchObject({ key: "Noa", value: 400 });
    expect(rank({ rows: ROWS, labelKey: "agent", valueKey: "items", fields: FIELDS }).rows[0]).toMatchObject({ key: "Amir", value: 9 });
  });
  it("totals every row value for a sum and gives shares of that total", () => {
    const result = rank({ rows: ROWS, labelKey: "agent", valueKey: "amount", calculation: "sum", fields: FIELDS, showShare: true });
    expect(result.summaryValue).toBe(500);
    expect(result.rows.map((row) => row.share)).toEqual([0.8, 0.1, 0.1]);
    expect(result.unit).toEqual({ type: "currency", currency: "USD" });
  });
  it("summarises an averaging ranking by the mean of the group values, without shares", () => {
    const result = rank({ rows: ROWS, labelKey: "agent", valueKey: "items", calculation: "average", fields: FIELDS, showShare: true });
    // Noa 3, Amir 9 (blank skipped), Unknown 5.
    expect(result.summary).toBe("average");
    expect(result.summaryValue).toBeCloseTo(17 / 3);
    expect(result.rows.every((row) => row.share === null)).toBe(true);
  });
  it("counts distinct values per group", () => {
    const { rows, summaryValue } = rank({ rows: ROWS, labelKey: "status", valueKey: "agent", calculation: "unique", fields: FIELDS });
    expect(rows.map((row) => row.value)).toEqual([1, 1, 0]);
    expect(summaryValue).toBe(2);
  });
  it("merges labels that end in a merge suffix", () => {
    const rows = [{ name: "Acme Retail" }, { name: "Acme Wholesale" }, { name: "Retail" }, { name: "Zen Labs" }];
    const result = rank({ rows, labelKey: "name", fields: [], mergeSuffixes: ["Retail", "Wholesale"] });
    expect(result.rows.map((row) => [row.key, row.value])).toEqual([
      ["Acme", 2],
      ["Retail", 1],
      ["Zen Labs", 1],
    ]);
  });
  it("refuses mixed currencies", () => {
    expect(() => rank({ rows: MIXED_ROWS, labelKey: "agent", valueKey: "amount", fields: FIELDS })).toThrow(SummaryNotice);
  });
  it("gives an empty list for zero rows", () => {
    expect(rank({ rows: [], labelKey: "agent", fields: FIELDS })).toMatchObject({ rows: [], summaryValue: 0 });
  });
});
