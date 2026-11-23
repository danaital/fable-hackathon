import { describe, expect, it } from "vitest";
import type { ReportDef } from "@/data/types";
import { defaultViewState } from "@/features/report/viewState";
import { groupViews, isDirty, matchesSearch, moveItem, resolveInitialView, validateName } from "./logic";
import { PAGE_TYPE, hydrateState, snapshotState, storedViewListSchema, storedViewSchema, type ViewEntry } from "./model";

const report: ReportDef = {
  id: "orders",
  titleKey: "report.orders.title",
  descKey: "report.orders.desc",
  icon: "orders",
  tags: [],
  fields: [
    { key: "status", type: "status", labelKey: "field.status" },
    { key: "amount", type: "currency", labelKey: "field.amount" },
    { key: "orderDate", type: "date", labelKey: "field.orderDate" },
  ],
};

const entry = (id: string, extra: Partial<ViewEntry> = {}): ViewEntry => ({
  id,
  name: id,
  description: "",
  reportId: report.id,
  pageType: PAGE_TYPE,
  state: {},
  system: false,
  ...extra,
});

const views = [entry("mine"), entry("other"), entry("sys-a", { system: true }), entry("sys-b", { system: true })];

describe("resolveInitialView", () => {
  it("prefers the navigation target over everything else", () => {
    const result = resolveInitialView({ views, targetId: "other", defaultId: "mine", lastUsedId: "sys-b" });
    expect(result.view?.id).toBe("other");
  });

  it("falls to the user default, then last used, then the first system view", () => {
    expect(resolveInitialView({ views, defaultId: "mine", lastUsedId: "other" }).view?.id).toBe("mine");
    expect(resolveInitialView({ views, lastUsedId: "other" }).view?.id).toBe("other");
    expect(resolveInitialView({ views }).view?.id).toBe("sys-a");
  });

  it("opens the built-in default when the report has no views at all", () => {
    expect(resolveInitialView({ views: [], targetId: "gone", lastUsedId: "gone" })).toEqual({ view: null, staleDefault: false });
  });

  it("skips a target or last-used view that no longer exists", () => {
    expect(resolveInitialView({ views, targetId: "gone", defaultId: "mine" }).view?.id).toBe("mine");
    expect(resolveInitialView({ views, lastUsedId: "gone" }).view?.id).toBe("sys-a");
  });

  it("reports a default that points at a deleted view and moves on", () => {
    const result = resolveInitialView({ views, defaultId: "gone", lastUsedId: "other" });
    expect(result).toEqual({ view: views[1], staleDefault: true });
    expect(resolveInitialView({ views, defaultId: "mine" }).staleDefault).toBe(false);
  });
});

describe("isDirty", () => {
  const base = defaultViewState(report);

  it("is clean for equal states, whatever the key order", () => {
    const sameInOtherOrder = { ...base, totals: { amount: "sum" as const, status: "count" as const } };
    const loaded = { ...base, totals: { status: "count" as const, amount: "sum" as const } };
    expect(isDirty(base, defaultViewState(report))).toBe(false);
    expect(isDirty(sameInOtherOrder, loaded)).toBe(false);
  });

  it("treats an absent optional flag like an undefined one", () => {
    const rule = { id: "1", field: "status", operator: "equals", values: ["late"] };
    expect(isDirty({ ...base, filters: [{ ...rule, enabled: undefined }] }, { ...base, filters: [rule] })).toBe(false);
  });

  it("is dirty when a filter, a sort or the page size changes", () => {
    expect(isDirty({ ...base, filters: [{ id: "1", field: "status", operator: "equals", values: ["late"] }] }, base)).toBe(true);
    expect(isDirty({ ...base, sorts: [{ key: "amount", direction: "desc" }] }, base)).toBe(true);
    expect(isDirty({ ...base, pageSize: 50 }, base)).toBe(true);
  });

  it("ignores the search term, which a view never saves", () => {
    expect(isDirty({ ...base, search: "acme" }, base)).toBe(false);
  });

  it("is clean right after a view with a preset-period filter is applied, even once the period is turned into dates", () => {
    const stored = { filters: [{ id: "f", field: "orderDate", operator: "between", values: [], period: "this_month" }] };
    const loaded = hydrateState(report, stored);
    // What the filter bar may do on apply: resolve the period to today's range and fill in the defaults.
    const live = {
      ...loaded,
      filters: loaded.filters.map((rule) => ({ ...rule, values: ["2026-11-01", "2026-11-30"], enabled: true, mandatory: false })),
    };
    expect(isDirty(loaded, hydrateState(report, stored))).toBe(false);
    expect(isDirty(live, loaded)).toBe(false);
  });

  it("is dirty when the preset period itself changes, or when hand-picked dates change", () => {
    const rule = { id: "f", field: "orderDate", operator: "between", values: ["2026-11-01", "2026-11-30"] };
    const withPeriod = (period: string) => ({ ...base, filters: [{ ...rule, period }] });
    expect(isDirty(withPeriod("last_month"), withPeriod("this_month"))).toBe(true);
    expect(isDirty({ ...base, filters: [{ ...rule, values: ["2026-11-02", "2026-11-30"] }] }, { ...base, filters: [rule] })).toBe(true);
    // Not a preset period, so the dates are what counts.
    expect(isDirty({ ...base, filters: [{ ...rule, period: "custom", values: ["2026-10-01", "2026-10-31"] }] }, withPeriod("custom"))).toBe(true);
  });

  it("is dirty when a filter is switched off", () => {
    const rule = { id: "1", field: "status", operator: "equals", values: ["late"] };
    expect(isDirty({ ...base, filters: [{ ...rule, enabled: false }] }, { ...base, filters: [rule] })).toBe(true);
  });

  it("is dirty when only the column order changes", () => {
    expect(isDirty({ ...base, columns: [...base.columns].reverse() }, base)).toBe(true);
  });

  it("tells 'show all widgets' from 'show none'", () => {
    expect(isDirty({ ...base, widgets: [] }, base)).toBe(true);
  });
});

describe("validateName", () => {
  const taken = ["Late orders", "This month"];

  it("requires a name with at least two non-space characters", () => {
    expect(validateName({ name: "   ", taken })).toBe("required");
    expect(validateName({ name: " a ", taken })).toBe("tooShort");
    expect(validateName({ name: "a b", taken })).toBeNull();
  });

  it("rejects names over the limit", () => {
    expect(validateName({ name: "x".repeat(51), taken })).toBe("tooLong");
    expect(validateName({ name: "x".repeat(50), taken })).toBeNull();
  });

  it("finds duplicates whatever the case or surrounding spaces", () => {
    expect(validateName({ name: "  late ORDERS ", taken })).toBe("duplicate");
    expect(validateName({ name: "Late orders 2", taken })).toBeNull();
  });

  it("lets an update keep its own name, but not take another view's", () => {
    expect(validateName({ name: "late orders", taken, ownName: "Late orders" })).toBeNull();
    expect(validateName({ name: "This month", taken, ownName: "Late orders" })).toBe("duplicate");
  });
});

describe("groupViews", () => {
  it("puts each view in one group, the user default first", () => {
    const groups = groupViews({ views, defaultId: "other", favorites: new Set(["mine", "sys-b", "other"]) });
    expect(groups.default.map((view) => view.id)).toEqual(["other"]);
    expect(groups.favorites.map((view) => view.id)).toEqual(["mine", "sys-b"]);
    expect(groups.system.map((view) => view.id)).toEqual(["sys-a"]);
    expect(groups.custom).toEqual([]);
  });

  it("uses the first system view as the default when the user has none", () => {
    const groups = groupViews({ views, defaultId: "gone", favorites: new Set() });
    expect(groups.default.map((view) => view.id)).toEqual(["sys-a"]);
    expect(groups.custom.map((view) => view.id)).toEqual(["mine", "other"]);
  });
});

describe("matchesSearch", () => {
  const view = entry("v", { name: "Late orders", description: "Past the delivery date" });

  it("searches the name, the description and the extra text, ignoring case", () => {
    expect(matchesSearch({ view, term: " LATE " })).toBe(true);
    expect(matchesSearch({ view, term: "delivery" })).toBe(true);
    expect(matchesSearch({ view, term: "customers", extra: "Customers" })).toBe(true);
    expect(matchesSearch({ view, term: "refund" })).toBe(false);
    expect(matchesSearch({ view, term: "" })).toBe(true);
  });
});

describe("moveItem", () => {
  it("moves an item one place and leaves the input alone", () => {
    const items = ["a", "b", "c"];
    expect(moveItem({ items, index: 0, delta: 1 })).toEqual(["b", "a", "c"]);
    expect(moveItem({ items, index: 2, delta: -1 })).toEqual(["a", "c", "b"]);
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("does nothing at the ends", () => {
    expect(moveItem({ items: ["a", "b"], index: 0, delta: -1 })).toEqual(["a", "b"]);
    expect(moveItem({ items: ["a", "b"], index: 1, delta: 1 })).toEqual(["a", "b"]);
  });
});

describe("stored views from older or damaged data", () => {
  it("loads a view saved before newer state fields existed, filling them from the report defaults", () => {
    const old = storedViewSchema.parse({ id: "1", name: "Old", reportId: "orders", state: { columns: ["amount", "status"] } });
    expect(old).toMatchObject({ description: "", pageType: PAGE_TYPE });
    expect(hydrateState(report, old.state)).toEqual({ ...defaultViewState(report), columns: ["amount", "status"] });
  });

  it("keeps the good parts of a view when one part is malformed", () => {
    const view = storedViewSchema.parse({
      id: "1",
      name: "Odd",
      reportId: "orders",
      state: { pageSize: "many", sorts: [{ key: "amount", direction: "desc" }] },
    });
    const state = hydrateState(report, view.state);
    expect(state.pageSize).toBe(defaultViewState(report).pageSize);
    expect(state.sorts).toEqual([{ key: "amount", direction: "desc" }]);
  });

  it("keeps keys written by a newer version", () => {
    const view = storedViewSchema.parse({
      id: "1",
      name: "Newer",
      reportId: "orders",
      state: { density: "compact", filters: [{ id: "f", field: "status", operator: "equals", values: ["late"], caseSensitive: true }] },
    });
    expect(hydrateState(report, view.state)).toMatchObject({
      density: "compact",
      filters: [{ field: "status", caseSensitive: true }],
    });
  });

  it("drops references to fields the report no longer has", () => {
    const state = hydrateState(report, {
      columns: ["status", "removed"],
      sorts: [{ key: "removed", direction: "asc" }],
      groupBy: ["removed", "status"],
      totals: { removed: "sum", amount: "sum" },
      filters: [{ id: "f", field: "removed", operator: "equals", values: [1] }],
    });
    expect(state).toMatchObject({ columns: ["status"], sorts: [], groupBy: ["status"], totals: { amount: "sum" }, filters: [] });
  });

  it("falls back to the report's columns when none of the stored ones exist any more", () => {
    expect(hydrateState(report, { columns: ["removed"] }).columns).toEqual(["status", "amount", "orderDate"]);
  });

  it("never takes a search term from a view, and never saves one", () => {
    const old = storedViewSchema.parse({ id: "1", name: "Old", reportId: "orders", state: { search: "acme", pageSize: 50 } });
    expect(hydrateState(report, old.state)).toMatchObject({ search: "", pageSize: 50 });
    const saved = snapshotState({ ...defaultViewState(report), search: "acme", pageSize: 50 });
    expect(saved).not.toHaveProperty("search");
    expect(saved).toMatchObject({ pageSize: 50, columns: ["status", "amount", "orderDate"] });
  });

  it("keeps 'show no widgets' apart from 'not stored'", () => {
    expect(hydrateState(report, { widgets: [], charts: null })).toMatchObject({ widgets: [], charts: null });
    expect(hydrateState(report, {}).widgets).toBeNull();
  });

  it("drops an unreadable view without losing the rest of the list", () => {
    const list = storedViewListSchema.parse([{ id: "1", name: "Good", reportId: "orders", state: {} }, { name: "No id" }, "junk"]);
    expect(list.map((view) => view.id)).toEqual(["1"]);
  });
});
