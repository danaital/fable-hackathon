import { describe, expect, it } from "vitest";
import { summaryConfigSchema } from "../config";
import { FIELDS, NOW } from "../testRows";
import { computeChart, drawnType } from "./model";
import { bucketOf, pickTimeStep, timeView } from "./timeStep";

const chartOf = (input: object) => summaryConfigSchema.parse({ widgets: [], charts: [{ id: "c", title: { en: "t", he: "t" }, ...input }] }).charts[0];
const days = (...list: string[]) => list.map((orderDate) => ({ orderDate, status: "late", items: 1 }));
const base = { fields: FIELDS, now: NOW, labelFor: (key: string) => key, title: "t" };

describe("bucketOf", () => {
  it("cuts a day to its year, month, week or day", () => {
    expect(bucketOf("2026-11-20", "year")).toBe("2026");
    expect(bucketOf("2026-11-20", "month")).toBe("2026-11");
    expect(bucketOf("2026-11-20", "day")).toBe("2026-11-20");
  });

  it("starts a week on Monday, also across a month and a year boundary", () => {
    expect(bucketOf("2026-11-20", "week")).toBe("2026-11-16");
    expect(bucketOf("2026-11-16", "week")).toBe("2026-11-16");
    expect(bucketOf("2026-11-01", "week")).toBe("2026-10-26");
    expect(bucketOf("2027-01-01", "week")).toBe("2026-12-28");
  });
});

describe("pickTimeStep", () => {
  it("keeps the configured step while it gives enough points", () => {
    expect(pickTimeStep(["2026-01-05", "2026-02-05", "2026-03-05"], "month")).toEqual({ step: "month", buckets: 3 });
    expect(pickTimeStep(["2024-01-05", "2025-02-05", "2026-03-05"], "year")).toEqual({ step: "year", buckets: 3 });
  });

  it("goes from month to week when the days sit in one month", () => {
    expect(pickTimeStep(["2026-11-02", "2026-11-10", "2026-11-20"], "month")).toEqual({ step: "week", buckets: 3 });
  });

  it("goes on to day when the days sit in one week", () => {
    expect(pickTimeStep(["2026-11-16", "2026-11-17", "2026-11-19"], "month")).toEqual({ step: "day", buckets: 3 });
  });

  it("goes from year to month, never to a coarser step", () => {
    expect(pickTimeStep(["2026-01-05", "2026-02-05", "2026-03-05"], "year")).toEqual({ step: "month", buckets: 3 });
    expect(pickTimeStep(["2026-01-05", "2027-02-05"], "day")).toEqual({ step: "day", buckets: 2 });
  });

  it("settles for two points at the coarsest step that has them", () => {
    expect(pickTimeStep(["2026-10-30", "2026-11-20"], "month")).toEqual({ step: "month", buckets: 2 });
    expect(pickTimeStep(["2026-11-02", "2026-11-20"], "month")).toEqual({ step: "week", buckets: 2 });
  });

  it("keeps the configured step when every step gives one point or none", () => {
    expect(pickTimeStep(["2026-11-20", "2026-11-20"], "month")).toEqual({ step: "month", buckets: 1 });
    expect(pickTimeStep([], "month")).toEqual({ step: "month", buckets: 0 });
  });
});

describe("timeView", () => {
  const line = chartOf({ type: "line", dataField: "orderDate", granularity: "month", sortBy: "label", limit: 2 });

  it("leaves other chart types and other fields alone", () => {
    const rows = days("2026-11-02", "2026-11-10", "2026-11-20");
    expect(timeView({ chart: chartOf({ type: "bar", dataField: "orderDate" }), rows, fields: FIELDS, now: NOW }).step).toBeNull();
    expect(timeView({ chart: chartOf({ type: "line", dataField: "status" }), rows, fields: FIELDS, now: NOW }).step).toBeNull();
  });

  it("regroups a one-month line by week, labelled by each week's Monday, without dropping points", () => {
    const rows = days("2026-11-02", "2026-11-10", "2026-11-11", "2026-11-20");
    const result = computeChart({ ...base, chart: line, rows });
    expect(result.kind === "data" && result.step).toBe("week");
    expect(result.kind === "data" && result.data.categories.map((category) => category.key)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(result.kind === "data" && result.data.series[0].values).toEqual([1, 2, 1]);
  });

  it("counts only the days inside the chart's own date range", () => {
    const chart = chartOf({ type: "area", dataField: "orderDate", sortBy: "label", dateRange: { field: "orderDate", start: "2026-11-16", end: "2026-11-22" } });
    const result = computeChart({ ...base, chart, rows: days("2026-01-05", "2026-06-05", "2026-11-16", "2026-11-17", "2026-11-19") });
    expect(result.kind === "data" && result.step).toBe("day");
    expect(result.kind === "data" && result.data.categories).toHaveLength(3);
  });

  it("keeps a split chart split when it regroups", () => {
    const chart = chartOf({ type: "area", dataField: "items", groupBy: "orderDate", series: { field: "status", aggregation: "sum" } });
    const result = computeChart({ ...base, chart, rows: days("2026-11-02", "2026-11-10", "2026-11-20") });
    expect(result.kind === "data" && result.step).toBe("week");
    expect(result.kind === "data" && result.data.series.map((series) => series.values)).toEqual([[1, 1, 1]]);
  });
});

describe("drawnType", () => {
  it("draws a line or area with fewer than two categories as bars", () => {
    const one = computeChart({ ...base, chart: chartOf({ type: "area", dataField: "orderDate", sortBy: "label" }), rows: days("2026-11-20", "2026-11-20") });
    expect(one.kind === "data" && one.step).toBeNull();
    expect(one.kind === "data" && drawnType("area", one.data)).toBe("bar");
    expect(one.kind === "data" && drawnType("pie", one.data)).toBe("pie");
    const two = computeChart({ ...base, chart: chartOf({ type: "line", dataField: "orderDate", sortBy: "label" }), rows: days("2026-10-30", "2026-11-20") });
    expect(two.kind === "data" && drawnType("line", two.data)).toBe("line");
  });
});
