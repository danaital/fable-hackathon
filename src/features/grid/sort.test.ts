import { describe, expect, it } from "vitest";
import type { FieldDef, Row } from "@/data/types";
import { nextSortRules, sortRows } from "./sort";

const fields: FieldDef[] = [
  { key: "name", type: "string", labelKey: "field.name" },
  { key: "amount", type: "currency", labelKey: "field.amount" },
  { key: "date", type: "date", labelKey: "field.orderDate" },
  { key: "active", type: "boolean", labelKey: "field.active" },
];

const rows: Row[] = [
  { name: "b", amount: 10, date: "2026-03-01" },
  { name: "a", amount: null, date: "2026-01-01" },
  { name: "a", amount: 5, date: null },
  { name: "c", amount: 200, date: "2026-02-01" },
];

const column = (key: string, list: Row[]) => list.map((row) => row[key]);

describe("sortRows", () => {
  it("sorts numbers numerically and puts missing values first when ascending", () => {
    expect(column("amount", sortRows(rows, [{ key: "amount", direction: "asc" }], fields))).toEqual([null, 5, 10, 200]);
  });

  it("puts missing values last when descending", () => {
    expect(column("amount", sortRows(rows, [{ key: "amount", direction: "desc" }], fields))).toEqual([200, 10, 5, null]);
  });

  it("treats an empty string as a value, not as missing", () => {
    const list: Row[] = [{ name: "b" }, { name: "" }, { name: null }];
    expect(column("name", sortRows(list, [{ key: "name", direction: "asc" }], fields))).toEqual([null, "", "b"]);
  });

  it("orders text case-insensitively with numeric parts in number order", () => {
    const list: Row[] = [{ name: "item 10" }, { name: "Item 2" }, { name: "item 1" }];
    expect(column("name", sortRows(list, [{ key: "name", direction: "asc" }], fields))).toEqual(["item 1", "Item 2", "item 10"]);
  });

  it("parses numeric strings and puts unparsable values after the missing ones, before every number", () => {
    const list: Row[] = [{ amount: "20" }, { amount: 3 }, { amount: "n/a" }, { amount: null }];
    expect(column("amount", sortRows(list, [{ key: "amount", direction: "asc" }], fields))).toEqual([null, "n/a", 3, "20"]);
    expect(column("amount", sortRows(list, [{ key: "amount", direction: "desc" }], fields))).toEqual(["20", 3, "n/a", null]);
  });

  it("orders option values by their translated label when one is given", () => {
    const statusFields: FieldDef[] = [{ key: "status", type: "status", labelKey: "field.status" }];
    const labels: Record<string, string> = { late: "A", delivered: "Z" };
    const list: Row[] = [{ status: "late" }, { status: "delivered" }];
    const rule = [{ key: "status", direction: "asc" as const }];
    expect(column("status", sortRows(list, rule, statusFields))).toEqual(["delivered", "late"]);
    expect(column("status", sortRows(list, rule, statusFields, (_field, value) => labels[String(value)]))).toEqual(["late", "delivered"]);
  });

  it("sorts dates by instant and false before true", () => {
    expect(column("date", sortRows(rows, [{ key: "date", direction: "asc" }], fields))).toEqual([
      null,
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
    const list: Row[] = [{ active: true }, { active: false }];
    expect(column("active", sortRows(list, [{ key: "active", direction: "asc" }], fields))).toEqual([false, true]);
  });

  it("applies rules in priority order", () => {
    const sorted = sortRows(
      rows,
      [
        { key: "name", direction: "asc" },
        { key: "amount", direction: "desc" },
      ],
      fields,
    );
    expect(sorted.map((r) => [r.name, r.amount])).toEqual([
      ["a", 5],
      ["a", null],
      ["b", 10],
      ["c", 200],
    ]);
  });

  it("does not change the input", () => {
    const before = rows.map((r) => r.name);
    sortRows(rows, [{ key: "name", direction: "asc" }], fields);
    expect(rows.map((r) => r.name)).toEqual(before);
  });
});

describe("nextSortRules", () => {
  it("cycles ascending, descending, removed", () => {
    const asc = nextSortRules([], "name");
    const desc = nextSortRules(asc, "name");
    expect(asc).toEqual([{ key: "name", direction: "asc" }]);
    expect(desc).toEqual([{ key: "name", direction: "desc" }]);
    expect(nextSortRules(desc, "name")).toEqual([]);
  });

  it("adds a new column at the end of the priority chain", () => {
    const first = [{ key: "name", direction: "asc" as const }];
    expect(nextSortRules(first, "amount")).toEqual([...first, { key: "amount", direction: "asc" }]);
  });

  it("keeps a column's place when its direction flips, and closes the gap when it is removed", () => {
    const chain = [
      { key: "name", direction: "asc" as const },
      { key: "amount", direction: "asc" as const },
      { key: "date", direction: "desc" as const },
    ];
    expect(nextSortRules(chain, "name").map((rule) => rule.key)).toEqual(["name", "amount", "date"]);
    expect(nextSortRules(chain, "date").map((rule) => rule.key)).toEqual(["name", "amount"]);
  });

  it("replaces the chain only when asked", () => {
    const first = [{ key: "name", direction: "asc" as const }];
    expect(nextSortRules(first, "amount", false)).toEqual([{ key: "amount", direction: "asc" }]);
  });
});
