import { describe, expect, it } from "vitest";
import type { FieldDef } from "@/data/types";
import type { ViewState } from "@/features/report/viewState";
import { anchorKeys, applyColumns, defaultDraft, matchesColumn, moveBy, moveSet, place, sameDraft, toDraft, type ColumnDraft } from "./columns";

const fields: FieldDef[] = ["id", "name", "amount", "date", "email"].map((key) => ({ key, type: "string", labelKey: "field.name" }));
const anchors = anchorKeys(fields);
const draft: ColumnDraft = { visible: ["id", "name", "amount"], hidden: ["date", "email"] };

describe("toDraft", () => {
  it("keeps the view's order, puts the anchor first and hides fields the view does not list", () => {
    expect(toDraft(fields, ["amount", "name"])).toEqual({ visible: ["id", "amount", "name"], hidden: ["date", "email"] });
  });

  it("drops unknown keys and never hides the anchor", () => {
    expect(toDraft(fields, ["gone", "date"])).toEqual({ visible: ["id", "date"], hidden: ["name", "amount", "email"] });
    expect(toDraft(fields, []).visible).toEqual(["id"]);
  });

  it("recognises the default layout", () => {
    expect(sameDraft(defaultDraft(fields), toDraft(fields, ["id", "name", "amount", "date", "email"]))).toBe(true);
    expect(sameDraft(defaultDraft(fields), draft)).toBe(false);
  });
});

describe("moveBy", () => {
  it("moves a column up or down inside its list", () => {
    expect(moveBy({ draft, key: "name", delta: 1, anchors }).visible).toEqual(["id", "amount", "name"]);
    expect(moveBy({ draft, key: "email", delta: -1, anchors }).hidden).toEqual(["email", "date"]);
  });

  it("refuses to move past the ends, to move an anchor, or to move above an anchor", () => {
    expect(moveBy({ draft, key: "amount", delta: 1, anchors })).toBe(draft);
    expect(moveBy({ draft, key: "id", delta: 1, anchors })).toBe(draft);
    expect(moveBy({ draft, key: "name", delta: -1, anchors })).toBe(draft);
  });
});

describe("place", () => {
  it("moves columns to the end of the other list, keeping their order", () => {
    expect(place({ draft, keys: ["name", "amount"], target: "hidden", anchors })).toEqual({
      visible: ["id"],
      hidden: ["date", "email", "name", "amount"],
    });
  });

  it("inserts before a given column, within a list or across lists", () => {
    expect(place({ draft, keys: ["amount"], target: "visible", before: "name", anchors }).visible).toEqual(["id", "amount", "name"]);
    expect(place({ draft, keys: ["email"], target: "visible", before: "amount", anchors })).toEqual({
      visible: ["id", "name", "email", "amount"],
      hidden: ["date"],
    });
  });

  it("refuses to hide an anchor, even inside a bulk move, and to drop before one", () => {
    expect(place({ draft, keys: ["id"], target: "hidden", anchors })).toBe(draft);
    expect(place({ draft, keys: ["name", "id"], target: "hidden", anchors })).toBe(draft);
    expect(place({ draft, keys: ["date"], target: "visible", before: "id", anchors })).toBe(draft);
  });
});

describe("moveSet", () => {
  it("moves the whole selection of the same list when the column is selected, else only that column", () => {
    const selected = new Set(["name", "amount", "date"]);
    expect(moveSet(draft, "amount", selected)).toEqual(["name", "amount"]);
    expect(moveSet(draft, "email", selected)).toEqual(["email"]);
  });
});

describe("matchesColumn", () => {
  it("matches the key or the label, ignoring case, and everything for an empty term", () => {
    const field = fields[2];
    expect(matchesColumn({ field, label: "Total paid", term: "PAID" })).toBe(true);
    expect(matchesColumn({ field, label: "Total paid", term: "amou" })).toBe(true);
    expect(matchesColumn({ field, label: "Total paid", term: "zzz" })).toBe(false);
    expect(matchesColumn({ field, label: "Total paid", term: "  " })).toBe(true);
  });
});

describe("applyColumns", () => {
  const view: ViewState = {
    filters: [
      { id: "1", field: "amount", operator: "gt", values: [5] },
      { id: "2", field: "date", operator: "between", values: [], period: "last_7_days", mandatory: true },
      { id: "3", field: "name", operator: "contains", values: ["a"] },
    ],
    relation: "and",
    search: "",
    sorts: [],
    columns: ["id", "name", "amount", "date"],
    groupBy: [],
    totals: {},
    widgets: null,
    charts: null,
    pageSize: 25,
  };
  const fieldsHidden = ["amount", "date"];

  it("sets the columns and leaves the filters alone by default", () => {
    const next = applyColumns(view, { columns: ["id", "name"] });
    expect(next.columns).toEqual(["id", "name"]);
    expect(next.filters).toBe(view.filters);
  });

  it("removes or clears the filters of the hidden columns, but never a mandatory one", () => {
    const removed = applyColumns(view, { columns: ["id", "name"], filters: { action: "remove", fields: fieldsHidden } });
    expect(removed.filters.map((rule) => rule.id)).toEqual(["2", "3"]);
    const cleared = applyColumns(view, { columns: ["id", "name"], filters: { action: "clear", fields: fieldsHidden } });
    expect(cleared.filters.map((rule) => rule.values)).toEqual([[], [], ["a"]]);
    expect(cleared.filters[1].period).toBe("last_7_days");
  });
});
