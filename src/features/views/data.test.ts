import { describe, expect, it } from "vitest";
import { REPORTS } from "@/data/reports";
import { OPERATORS_BY_TYPE, PERIODS_BY_TYPE, isTimePeriod } from "@/features/filters/engine";
import { defaultViewState } from "@/features/report/viewState";
import { createFormatters } from "@/lib/format";
import { filtersMessages } from "@/i18n/messages/filters";
import { viewsMessages } from "@/i18n/messages/views";
import { MAX_FILTER_VALUES, OPERATOR_PREFIX, PERIOD_PREFIX, describeView } from "./describe";
import { hydrateState } from "./model";
import { SYSTEM_ID_PREFIX, SYSTEM_VIEWS } from "./systemViews";

const MIN_SYSTEM_VIEWS = 2;

describe("system views", () => {
  it("gives every report at least two, with unique ids", () => {
    for (const report of REPORTS) {
      expect(SYSTEM_VIEWS.filter((view) => view.reportId === report.id).length).toBeGreaterThanOrEqual(MIN_SYSTEM_VIEWS);
    }
    expect(new Set(SYSTEM_VIEWS.map((view) => view.id)).size).toBe(SYSTEM_VIEWS.length);
    expect(SYSTEM_VIEWS.every((view) => view.id.startsWith(SYSTEM_ID_PREFIX))).toBe(true);
  });

  it("only uses fields, operators, option values and periods that exist", () => {
    for (const view of SYSTEM_VIEWS) {
      const report = REPORTS.find((candidate) => candidate.id === view.reportId);
      expect(report, view.id).toBeDefined();
      if (!report) continue;
      // Hydrating drops unknown fields, so nothing may be lost.
      const state = hydrateState(report, view.state);
      expect(state.filters.length, view.id).toBe(view.state.filters?.length ?? 0);
      expect(state.sorts.length, view.id).toBe(view.state.sorts?.length ?? 0);
      for (const rule of state.filters) {
        const field = report.fields.find((candidate) => candidate.key === rule.field);
        if (rule.compareField) {
          // A two-field rule compares the combined result with a value, so option lists do not apply.
          expect(report.fields.some((candidate) => candidate.key === rule.compareField), `${view.id} compare field`).toBe(true);
          continue;
        }
        expect(field && (OPERATORS_BY_TYPE[field.type] as readonly string[]).includes(rule.operator), `${view.id} operator`).toBe(true);
        if (rule.period) expect(isTimePeriod(rule.period), `${view.id} period`).toBe(true);
        // Only fields with a fixed option list can be checked against it; amounts and dates are free values.
        if (field?.options) for (const value of rule.values) expect(field.options, `${view.id} value`).toContain(value);
      }
    }
  });
});

describe("filter labels used by the preview and the wizard", () => {
  const labels: Record<string, string> = filtersMessages.en;

  it("exist for every operator and period the wizard offers", () => {
    for (const operator of new Set(Object.values(OPERATORS_BY_TYPE).flat())) expect(labels[`${OPERATOR_PREFIX}.${operator}`], operator).toBeTruthy();
    for (const period of new Set(Object.values(PERIODS_BY_TYPE).flat())) expect(labels[`${PERIOD_PREFIX}.${period}`], period).toBeTruthy();
  });
});

describe("describeView", () => {
  const report = REPORTS[0];
  const en: Record<string, string> = viewsMessages.en;
  const t = (key: string, vars: Record<string, string | number> = {}) =>
    (en[key] ?? key).replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  const describe_ = (patch: Partial<ReturnType<typeof defaultViewState>>) =>
    describeView({
      report,
      state: { ...defaultViewState(report), ...patch },
      t,
      tData: (_prefix, value) => value,
      format: createFormatters("en"),
      widgetTitles: new Map([
        ["a", "Widget A"],
        ["b", "Widget B"],
      ]),
      chartTitles: new Map(),
    });

  it("leaves out sections with no content, but always answers for widgets and charts", () => {
    expect(describe_({}).map((section) => section.id)).toEqual(["columns", "widgets", "charts", "page"]);
  });

  it("lists the first values of a filter and folds the rest into a count", () => {
    const values = ["late", "shipped", "returned", "cancelled", "delivered"];
    const [, filters] = describe_({ filters: [{ id: "1", field: "status", operator: "in", values }] });
    expect(filters.id).toBe("filters");
    expect(filters.summary).toBe("1");
    expect(filters.items[0]).toContain(values.slice(0, MAX_FILTER_VALUES).join(", "));
    expect(filters.items[0]).toContain(`+${values.length - MAX_FILTER_VALUES} more`);
    expect(filters.items[0]).not.toContain("cancelled");
  });

  it("counts only filters that are switched on, and marks the others", () => {
    const rule = { field: "status", operator: "equals", values: ["late"] };
    const [, filters] = describe_({ filters: [{ ...rule, id: "1" }, { ...rule, id: "2", enabled: false }] });
    expect(filters.summary).toBe("1");
    expect(filters.items.at(-1)).toContain("switched off");
  });

  it("tells 'all widgets' from 'no widgets'", () => {
    const summaryOf = (widgets: string[] | null) => describe_({ widgets }).find((section) => section.id === "widgets")?.summary;
    expect(summaryOf(null)).toBe("All");
    expect(summaryOf([])).toBe("None");
    expect(summaryOf(["a", "b", "removed-from-report"])).toBe("2");
  });
});
