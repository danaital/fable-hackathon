import { describe, expect, it } from "vitest";
import type { FieldDef, Row } from "@/data/types";
import { groupKey, groupRows, orderGroups, prepareRows } from "./prepare";

const fields: FieldDef[] = [
  { key: "status", type: "status", labelKey: "field.status", optionPrefix: "status" },
  { key: "channel", type: "enum", labelKey: "field.channel" },
  { key: "amount", type: "currency", labelKey: "field.amount" },
];

const rows: Row[] = [
  { status: "late", channel: "web", amount: 10 },
  { status: "delivered", channel: "web", amount: 500 },
  { status: "late", channel: "phone", amount: 30 },
  { status: "late", channel: "web", amount: 20 },
  { status: null, channel: "", amount: 1 },
  { status: "", channel: null, amount: 2 },
];

describe("groupKey", () => {
  it("keeps missing and empty values apart and stringifies the rest", () => {
    expect(groupKey({ a: null }, ["a"])).not.toBe(groupKey({ a: "" }, ["a"]));
    expect(groupKey({ a: 1 }, ["a"])).toBe(groupKey({ a: "1" }, ["a"]));
    expect(groupKey({ a: "x", b: "y" }, ["a", "b"])).not.toBe(groupKey({ a: "xy", b: "" }, ["a", "b"]));
  });
});

describe("groupRows", () => {
  it("buckets by the composite key in order of first appearance", () => {
    const groups = groupRows(rows, ["status", "channel"]);
    expect(groups.map((group) => [group.values, group.rows.length])).toEqual([
      [["late", "web"], 2],
      [["delivered", "web"], 1],
      [["late", "phone"], 1],
      [[null, ""], 1],
      [["", null], 1],
    ]);
  });
});

describe("orderGroups", () => {
  const groups = groupRows(rows.slice(0, 4), ["status"]);
  const groupFields = [fields[0]];
  const names = (list: typeof groups) => list.map((group) => group.values[0]);

  it("orders by name, by row count and by summed amount, in both directions", () => {
    expect(names(orderGroups({ groups, fields: groupFields, order: { by: "name", direction: "asc" } }))).toEqual(["delivered", "late"]);
    expect(names(orderGroups({ groups, fields: groupFields, order: { by: "rowCount", direction: "desc" } }))).toEqual(["late", "delivered"]);
    expect(
      names(orderGroups({ groups, fields: groupFields, order: { by: "amount", direction: "desc", amountField: "amount" } })),
    ).toEqual(["delivered", "late"]);
    expect(names(orderGroups({ groups, fields: groupFields, order: { by: "dataOrder", direction: "desc" } }))).toEqual(["late", "delivered"]);
    expect(names(orderGroups({ groups, fields: groupFields, order: { by: "amount", direction: "desc" } }))).toEqual(["late", "delivered"]);
  });

  it("orders option fields by their translated label", () => {
    const labels: Record<string, string> = { late: "A late", delivered: "Z delivered" };
    const ordered = orderGroups({
      groups,
      fields: groupFields,
      order: { by: "name", direction: "asc" },
      labelFor: (_field, value) => labels[String(value)],
    });
    expect(names(ordered)).toEqual(["late", "delivered"]);
  });
});

describe("prepareRows", () => {
  it("sorts, and returns no groups when the view does not group", () => {
    const prepared = prepareRows({ rows, fields, view: { sorts: [{ key: "amount", direction: "desc" }], groupBy: [] } });
    expect(prepared.groups).toBeNull();
    expect(prepared.rows[0].amount).toBe(500);
  });

  it("groups the sorted rows and ignores unknown grouping fields", () => {
    const prepared = prepareRows({ rows, fields, view: { sorts: [{ key: "amount", direction: "desc" }], groupBy: ["status", "nope"] } });
    const late = prepared.groups?.find((group) => group.values[0] === "late");
    expect(late?.rows.map((row) => row.amount)).toEqual([30, 20, 10]);
    expect(prepared.groups?.[0].values).toEqual(["delivered"]);
  });
});
