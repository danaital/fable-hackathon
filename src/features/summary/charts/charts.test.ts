import { describe, expect, it } from "vitest";
import type { ReportDef } from "@/data/types";
import { en } from "@/i18n/en";
import type { I18nKey } from "@/i18n";
import { OTHER_KEY, type ChartData } from "../chartData";
import { chartStats, pruneHidden, toggleHidden } from "../chartView";
import { summaryConfigSchema } from "../config";
import { defaultCharts } from "./defaults";
import { chartSubtitle, describeChart } from "./describe";
import { buildModel, computeChart, isEmpty } from "./model";

const t = (key: I18nKey, vars: Record<string, string | number> = {}) =>
  en[key].replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));

const DATA: ChartData = {
  categories: [
    { key: "delivered", label: "Delivered" },
    { key: "late", label: "Late" },
    { key: OTHER_KEY, label: "Other" },
  ],
  series: [{ key: "__count__", label: "Orders by status", values: [6, 3, 1], shares: null }],
  foldedCount: 2,
  aggregation: "count",
  unit: { type: "number" },
};
const LOOK = { mode: "light", otherColor: "#777777" } as const;
const report = (fields: ReportDef["fields"]): ReportDef => ({ id: "r", titleKey: "action.close", descKey: "action.close", icon: "orders", tags: [], fields });
const chartOf = (input: object) => summaryConfigSchema.parse({ widgets: [], charts: [{ id: "c", title: { en: "Orders by status", he: "x" }, ...input }] }).charts[0];

describe("buildModel", () => {
  it("gives a single series each category's part of the total", () => {
    const model = buildModel({ data: DATA, type: "bar", hidden: [], ...LOOK });
    expect(model.series[0].shares).toEqual([0.6, 0.3, 0.1]);
    expect(model.rows[0]).toEqual({ label: "Delivered", v0: 6 });
  });

  it("drops a hidden slice from a pie and recomputes shares over what is visible", () => {
    const model = buildModel({ data: DATA, type: "pie", hidden: ["delivered"], ...LOOK });
    expect(model.categories.map((category) => category.key)).toEqual(["late", OTHER_KEY]);
    expect(model.series[0].shares).toEqual([0.75, 0.25]);
    expect(model.legend.map((item) => item.hidden)).toEqual([true, false, false]);
  });

  it("keeps each slice's look when another is hidden, and paints Other grey", () => {
    const all = buildModel({ data: DATA, type: "pie", hidden: [], ...LOOK });
    const some = buildModel({ data: DATA, type: "pie", hidden: ["delivered"], ...LOOK });
    expect(some.legend[1].style).toEqual(all.legend[1].style);
    expect(all.legend[2].style.color).toBe(LOOK.otherColor);
  });

  it("hides a series of an axis chart and reports nothing left", () => {
    const model = buildModel({ data: DATA, type: "bar", hidden: ["__count__"], ...LOOK });
    expect(model.series).toEqual([]);
    expect(isEmpty(DATA)).toBe(false);
  });
});

describe("legend state", () => {
  it("toggles a key and forgets keys that left the data", () => {
    const hidden = toggleHidden(toggleHidden([], "late"), "gone");
    expect(hidden).toEqual(["late", "gone"]);
    expect(pruneHidden(hidden, ["delivered", "late"])).toEqual(["late"]);
    expect(toggleHidden(["late"], "late")).toEqual([]);
  });
});

describe("describeChart", () => {
  const format = { formatValue: (value: number) => String(value), formatShare: (share: number) => `${Math.round(share * 100)}%` };

  it("names the type, the count, the total and the extremes with their shares", () => {
    const stats = chartStats({ data: DATA, type: "doughnut", hidden: [] });
    const sentence = describeChart({ stats, type: "doughnut", title: "Orders by status", t, withShares: true, ...format });
    expect(sentence).toBe(
      "Doughnut chart of Orders by status with 3 categories and a total of 10; the highest is Delivered with 6 (60%) and the lowest is Other with 1 (10%).",
    );
  });

  it("says there is no data when nothing is visible", () => {
    expect(describeChart({ stats: null, type: "bar", title: "x", t, withShares: true, ...format })).toBe(en["summary.noData"]);
  });

  it("builds the subtitle from the configuration", () => {
    const fieldLabel = (key: string) => key.toUpperCase();
    expect(chartSubtitle({ chart: chartOf({ type: "bar", dataField: "status" }), fieldLabel, t })).toBe("Number of rows by STATUS");
    const split = chartOf({ type: "area", dataField: "items", groupBy: "orderDate", series: { field: "channel", aggregation: "sum" } });
    expect(chartSubtitle({ chart: split, fieldLabel, t })).toBe("Sum of ITEMS by ORDERDATE, split by CHANNEL");
  });
});

describe("defaultCharts", () => {
  it("counts by the first two category fields and per month on the first date field", () => {
    const charts = defaultCharts(
      report([
        { key: "name", type: "string", labelKey: "field.status" },
        { key: "status", type: "status", labelKey: "field.status" },
        { key: "channel", type: "enum", labelKey: "field.channel" },
        { key: "currency", type: "enum", labelKey: "field.currency" },
        { key: "orderDate", type: "date", labelKey: "field.orderDate" },
      ]),
    );
    expect(charts.map(({ id, type, dataField }) => [id, type, dataField])).toEqual([
      ["default_status", "bar", "status"],
      ["default_channel", "doughnut", "channel"],
      ["default_orderDate_month", "line", "orderDate"],
    ]);
    expect(charts[2].granularity).toBe("month");
    expect(charts[0].title.en).toBe(`Rows by ${en["field.status"]}`);
  });

  it("never returns nothing for a report with fields", () => {
    const charts = defaultCharts(report([{ key: "name", type: "string", labelKey: "field.status" }]));
    expect(charts).toHaveLength(1);
    expect(charts[0].showOther).toBe(true);
  });
});

describe("computeChart", () => {
  const fields: ReportDef["fields"] = [{ key: "status", type: "status", labelKey: "field.status" }];
  const base = { fields, now: new Date(2026, 10, 23), labelFor: (key: string) => key, title: "t" };

  it("returns empty data for zero rows", () => {
    const result = computeChart({ ...base, chart: chartOf({ type: "bar", dataField: "status" }), rows: [] });
    expect(result.kind === "data" && isEmpty(result.data)).toBe(true);
  });

  it("withholds the chart when its display condition is not met", () => {
    const chart = chartOf({ type: "bar", dataField: "status", displayCondition: { rules: [{ subject: "rowCount", operator: "greaterThanOrEqual", value: 5 }] } });
    expect(computeChart({ ...base, chart, rows: [{ status: "late" }] })).toEqual({ kind: "withheld", outcome: "notMet" });
  });
});
