import { describe, expect, it } from "vitest";
import { darkTheme, lightTheme } from "@/styles/theme";
import { COUNT_SERIES_KEY, OTHER_KEY, buildChartData, type ChartData } from "./chartData";
import { chartStats, legendEntries, pruneHidden, toggleHidden, visibleSlices } from "./chartView";
import { summaryConfigSchema, type ChartConfig, type SummaryConfigInput } from "./config";
import { CHART_COLORS, SLOT_COUNT, assignSlots } from "./palette";
import { FIELDS, MIXED_ROWS, NOW, ROWS } from "./testRows";
import { SummaryNotice } from "./values";

type ChartInput = Omit<SummaryConfigInput["charts"][number], "id" | "title">;

const title = { en: "Chart", he: "תרשים" };
const chart = (input: ChartInput): ChartConfig => summaryConfigSchema.parse({ widgets: [], charts: [{ id: "c", title, ...input }] }).charts[0];
const build = (input: ChartInput, rows = ROWS): ChartData =>
  buildChartData({ chart: chart(input), rows, fields: FIELDS, now: NOW, labelFor: (key) => (key === OTHER_KEY ? "Other" : key), title: "Chart" });
const points = (data: ChartData) => data.categories.map(({ key }, index) => [key, data.series[0].values[index]]);

const letters = (counts: Record<string, number>) => Object.entries(counts).flatMap(([letter, count]) => Array.from({ length: count }, () => ({ letter })));
const LETTERS = letters({ c: 1, a: 4, b: 3, e: 1, d: 2 });

describe("category counting", () => {
  it("counts rows per distinct value, skips blanks and sorts by value", () => {
    const data = build({ type: "bar", dataField: "status" });
    expect(points(data)).toEqual([
      ["delivered", 2],
      ["late", 2],
    ]);
    expect(data.series[0]).toMatchObject({ key: COUNT_SERIES_KEY, label: "Chart" });
    expect(data.aggregation).toBe("count");
  });
  it("uses the group-by field as the category when there is one", () => {
    expect(points(build({ type: "bar", dataField: "status", groupBy: "agent" }))).toEqual([
      ["Amir", 2],
      ["Noa", 2],
    ]);
  });
  it("sorts by label or keeps first-seen order", () => {
    expect(points(build({ type: "bar", dataField: "letter", sortBy: "label" }, LETTERS)).map(([key]) => key)).toEqual(["a", "b", "c", "d", "e"]);
    expect(points(build({ type: "bar", dataField: "letter", sortBy: "none" }, LETTERS)).map(([key]) => key)).toEqual(["c", "a", "b", "e", "d"]);
  });
  it("orders numbers and dates by value, not as text", () => {
    const rows = [{ items: 10 }, { items: 9 }, { items: 100 }];
    expect(points(build({ type: "scatter", dataField: "items", sortBy: "label" }, rows)).map(([key]) => key)).toEqual(["9", "10", "100"]);
  });
  it("drops categories past the limit when Other is off", () => {
    const data = build({ type: "bar", dataField: "letter", limit: 2 }, LETTERS);
    expect(points(data)).toEqual([
      ["a", 4],
      ["b", 3],
    ]);
    expect(data.foldedCount).toBe(0);
  });
  it("adds Other on top of the limit for a value-count chart", () => {
    const data = build({ type: "bar", dataField: "letter", limit: 2, showOther: true }, LETTERS);
    expect(points(data)).toEqual([
      ["a", 4],
      ["b", 3],
      [OTHER_KEY, 4],
    ]);
    expect(data.foldedCount).toBe(3);
    expect(data.categories[2].label).toBe("Other");
  });
  it("keeps the total within the limit for a group-by chart", () => {
    const data = build({ type: "bar", dataField: "letter", groupBy: "letter", limit: 3, showOther: true }, LETTERS);
    expect(points(data)).toEqual([
      ["a", 4],
      ["b", 3],
      [OTHER_KEY, 4],
    ]);
  });
  it("adds no Other when everything fits", () => {
    expect(build({ type: "bar", dataField: "letter", limit: 5, showOther: true }, LETTERS).foldedCount).toBe(0);
  });
  it("buckets a date category by month by default, or by the granularity", () => {
    expect(points(build({ type: "line", dataField: "orderDate", sortBy: "label" }))).toEqual([
      ["2026-10", 2],
      ["2026-11", 2],
    ]);
    expect(points(build({ type: "line", dataField: "orderDate", granularity: "year" }))).toEqual([["2026", 4]]);
    expect(build({ type: "line", dataField: "orderDate", granularity: "day" }).categories).toHaveLength(4);
  });
  it("keeps only rows inside the chart's date range", () => {
    expect(points(build({ type: "bar", dataField: "status", dateRange: { field: "orderDate", type: "month_to_date" } }))).toEqual([["delivered", 2]]);
  });
  it("gives empty data for zero rows", () => {
    expect(build({ type: "bar", dataField: "status" }, [])).toMatchObject({ categories: [], series: [] });
  });
});

describe("series breakdown", () => {
  const breakdown = (aggregation: "count" | "sum" | "average", maxSeries?: number) =>
    build({ type: "multiBar", dataField: "items", groupBy: "status", series: { field: "agent", aggregation, maxSeries } });

  it("counts rows per series and category, with blanks filed under Other", () => {
    const data = breakdown("count");
    expect(data.categories.map((category) => category.key)).toEqual(["delivered", "late", OTHER_KEY]);
    expect(data.series.map((series) => [series.key, series.values])).toEqual([
      ["Amir", [0, 2, 0]],
      ["Noa", [2, 0, 0]],
      [OTHER_KEY, [0, 0, 1]],
    ]);
    expect(data.series[0].shares).toEqual([0, 1, 0]);
  });
  it("sums the data field and ranks series by their sum", () => {
    const data = breakdown("sum");
    expect(data.series.map((series) => [series.key, series.values])).toEqual([
      ["Amir", [0, 9, 0]],
      ["Noa", [6, 0, 0]],
      [OTHER_KEY, [0, 0, 5]],
    ]);
  });
  it("averages over rows that have a number, without shares", () => {
    const data = breakdown("average");
    expect(data.series.find((series) => series.key === "Noa")?.values).toEqual([3, 0, 0]);
    expect(data.series.find((series) => series.key === "Amir")?.values).toEqual([0, 9, 0]);
    expect(data.series[0].shares).toBeNull();
  });
  it("folds series past the maximum into Other", () => {
    const data = breakdown("sum", 1);
    expect(data.series.map((series) => [series.key, series.values])).toEqual([
      ["Amir", [0, 9, 0]],
      [OTHER_KEY, [6, 0, 5]],
    ]);
  });
  it("carries the unit of the data field and refuses mixed currencies", () => {
    const money = { type: "multiBar" as const, dataField: "amount", groupBy: "status", series: { field: "agent", aggregation: "sum" as const } };
    expect(build(money).unit).toEqual({ type: "currency", currency: "USD" });
    expect(() => build(money, MIXED_ROWS)).toThrow(SummaryNotice);
    expect(() => build({ ...money, series: { field: "agent" } }, MIXED_ROWS)).not.toThrow();
  });
});

describe("legend state", () => {
  const data = build({ type: "pie", dataField: "letter" }, LETTERS);

  it("lists slices for a pie and series for other charts", () => {
    expect(legendEntries(data, "pie").map((entry) => entry.key)).toEqual(["a", "b", "d", "c", "e"]);
    expect(legendEntries(data, "bar").map((entry) => entry.key)).toEqual([COUNT_SERIES_KEY]);
  });
  it("toggles a key on and off", () => {
    expect(toggleHidden([], "a")).toEqual(["a"]);
    expect(toggleHidden(["a", "b"], "a")).toEqual(["b"]);
  });
  it("drops hidden keys that left the data and keeps the rest", () => {
    const hidden = ["a", "gone"];
    expect(pruneHidden(hidden, ["a", "b"])).toEqual(["a"]);
    expect(pruneHidden(["a"], ["a", "b"])).toEqual(["a"]);
  });
  it("gives shares of the slices that are still visible", () => {
    const slices = visibleSlices(data, ["a", "b"]);
    expect(slices.map((slice) => [slice.key, slice.share])).toEqual([
      ["d", 0.5],
      ["c", 0.25],
      ["e", 0.25],
    ]);
  });
  it("describes what is visible", () => {
    expect(chartStats({ data, type: "pie", hidden: ["a"] })).toMatchObject({ mode: "categories", categories: 4, total: 7, top: { label: "b", value: 3 } });
    const series = build({ type: "multiBar", dataField: "items", groupBy: "status", series: { field: "agent", aggregation: "sum" } });
    expect(chartStats({ data: series, type: "multiBar", hidden: ["Amir"] })).toMatchObject({ mode: "series", series: 2, top: { label: "Noa", value: 6 } });
    expect(chartStats({ data: build({ type: "bar", dataField: "status" }, []), type: "bar", hidden: [] })).toBeNull();
  });
});

describe("palette", () => {
  it("keeps a key's style slot when other keys come and go", () => {
    const before = assignSlots(["web", "mobile", "phone"]);
    const after = assignSlots(["web", "phone"]);
    expect(after[0]).toBe(before[0]);
  });
  it("gives distinct slots while there are enough of them", () => {
    const slots = assignSlots(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(new Set(slots).size).toBe(SLOT_COUNT);
  });
  it("keeps 3:1 contrast against the card surface in both themes", () => {
    const channel = (hex: string, at: number) => {
      const value = parseInt(hex.slice(at, at + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
    const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
    for (const color of CHART_COLORS.light) expect(contrast(color, lightTheme.color.surface)).toBeGreaterThanOrEqual(3);
    for (const color of CHART_COLORS.dark) expect(contrast(color, darkTheme.color.surface)).toBeGreaterThanOrEqual(3);
  });
});
