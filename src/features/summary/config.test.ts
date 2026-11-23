import { describe, expect, it } from "vitest";
import { REPORTS } from "@/data/reports";
import { BUILT_IN_SUMMARY, FALLBACK_WIDGET } from "@/data/summary";
import { CHART_TYPES, WIDGET_TYPES, summaryConfigSchema } from "./config";
import { resolveSummaryConfig } from "./summaryConfig";
import { visibleItems } from "./useSummary";

const title = { en: "Title", he: "כותרת" };
const FIELD_PROPS = new Set(["field", "dataField", "groupBy", "labelField", "groupByField", "dateField", "requireSingleValueOn"]);

/** Every field key a config refers to, wherever it sits. */
function fieldKeys(value: unknown, prop = ""): string[] {
  if (typeof value === "string") return FIELD_PROPS.has(prop) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => fieldKeys(item, prop));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => fieldKeys(child, key));
}

describe("summaryConfigSchema", () => {
  it("fills in defaults", () => {
    const config = summaryConfigSchema.parse({
      widgets: [
        { id: "a", type: "basicCalculation", title },
        { id: "b", type: "ranking", title, labelField: "agent", drill: {} },
      ],
      charts: [{ id: "c", type: "bar", title, dataField: "status", series: { field: "agent" } }],
    });
    expect(config.widgets[0]).toMatchObject({ calculation: "count" });
    expect(config.widgets[1]).toMatchObject({ topN: 5, drill: { filters: [] } });
    expect(config.charts[0]).toMatchObject({ sortBy: "value", limit: 20, series: { aggregation: "count", maxSeries: 10 } });
  });

  const invalid: [string, unknown][] = [
    ["an unknown widget type", { widgets: [{ id: "a", type: "goals", title, target: 5 }], charts: [] }],
    ["an unknown chart type", { widgets: [], charts: [{ id: "c", type: "radar", title, dataField: "status" }] }],
    ["an unknown calculation", { widgets: [{ id: "a", type: "basicCalculation", title, calculation: "avg" }], charts: [] }],
    ["an unknown property", { widgets: [{ id: "a", type: "basicCalculation", title, script: "return 1" }], charts: [] }],
    ["a title in one language only", { widgets: [{ id: "a", type: "basicCalculation", title: { en: "Only" } }], charts: [] }],
    ["a title that is a plain string", { widgets: [{ id: "a", type: "basicCalculation", title: "Title" }], charts: [] }],
    ["a comparison without a date field", { widgets: [{ id: "a", type: "comparison", title }], charts: [] }],
    ["a relationship that is not implemented", { widgets: [{ id: "a", type: "comparison", title, dateField: "d", previousPeriod: { relationship: "holiday_adjusted" } }], charts: [] }],
    ["Top N above 20", { widgets: [{ id: "a", type: "ranking", title, labelField: "agent", topN: 21 }], charts: [] }],
    ["a chart without a data field", { widgets: [], charts: [{ id: "c", type: "bar", title }] }],
    ["duplicate ids", { widgets: [{ id: "a", type: "basicCalculation", title }, { id: "a", type: "basicCalculation", title }], charts: [] }],
    ["a missing list", { widgets: [] }],
  ];
  it.each(invalid)("rejects %s", (_, config) => {
    expect(summaryConfigSchema.safeParse(config).success).toBe(false);
  });
});

describe("built-in configs", () => {
  it.each(REPORTS.map((report) => [report.id, report] as const))("%s has enough widgets and charts, on real field keys", (id, report) => {
    const config = BUILT_IN_SUMMARY[id];
    expect(config.widgets.length).toBeGreaterThanOrEqual(4);
    expect(config.charts.length).toBeGreaterThanOrEqual(4);
    const known = new Set(report.fields.map((field) => field.key));
    expect(fieldKeys(config).filter((key) => !known.has(key))).toEqual([]);
  });
  it("orders covers every widget type and every chart type", () => {
    const { widgets, charts } = BUILT_IN_SUMMARY.orders;
    expect(widgets.length).toBeGreaterThanOrEqual(8);
    expect(charts.length).toBeGreaterThanOrEqual(8);
    expect(new Set(widgets.map((widget) => widget.type))).toEqual(new Set(WIDGET_TYPES));
    expect(new Set(charts.map((chart) => chart.type))).toEqual(new Set(CHART_TYPES));
  });
});

describe("resolveSummaryConfig", () => {
  const widgets = [{ id: "mine", type: "basicCalculation", title }];

  it("returns the built-in config without an override", () => {
    expect(resolveSummaryConfig("orders", {})).toEqual(BUILT_IN_SUMMARY.orders);
  });
  it("replaces only the lists the override carries", () => {
    const config = resolveSummaryConfig("orders", { orders: { widgets } });
    expect(config.widgets.map((widget) => widget.id)).toEqual(["mine"]);
    expect(config.charts).toEqual(BUILT_IN_SUMMARY.orders.charts);
  });
  it("falls back to the built-in config when the override is invalid", () => {
    expect(resolveSummaryConfig("orders", { orders: { widgets: [{ id: "x", type: "nope" }] } })).toEqual(BUILT_IN_SUMMARY.orders);
    expect(resolveSummaryConfig("orders", { orders: "broken" })).toEqual(BUILT_IN_SUMMARY.orders);
  });
  it("ignores overrides of other reports", () => {
    expect(resolveSummaryConfig("customers", { orders: { widgets } })).toEqual(BUILT_IN_SUMMARY.customers);
  });
  it("gives a report with no widgets the row-count card", () => {
    expect(resolveSummaryConfig("unknown-report", {})).toEqual({ widgets: [FALLBACK_WIDGET], charts: [] });
    expect(resolveSummaryConfig("orders", { orders: { widgets: [] } }).widgets).toEqual([FALLBACK_WIDGET]);
  });
});

describe("visibleItems", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("shows all for null and none for an empty list", () => {
    expect(visibleItems(items, null)).toEqual(items);
    expect(visibleItems(items, [])).toEqual([]);
  });
  it("keeps configuration order and ignores unknown ids", () => {
    expect(visibleItems(items, ["c", "zzz", "a"])).toEqual([{ id: "a" }, { id: "c" }]);
  });
});
