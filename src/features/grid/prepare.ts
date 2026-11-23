import type { CellValue, FieldDef, FieldType, Row } from "@/data/types";
import type { ViewState } from "@/features/report/viewState";
import { comparatorFor, sortRows, type LabelFor, type SortDirection } from "./sort";

export const GROUP_ORDERS = ["dataOrder", "name", "rowCount", "amount"] as const;
export type GroupOrderBy = (typeof GROUP_ORDERS)[number];
export interface GroupOrder {
  by: GroupOrderBy;
  direction: SortDirection;
  /** Numeric field summed per group when `by` is "amount". */
  amountField?: string;
}
export const DEFAULT_GROUP_ORDER: GroupOrder = { by: "dataOrder", direction: "asc" };

export const GROUPABLE_TYPES: ReadonlySet<FieldType> = new Set(["string", "enum", "status", "country", "boolean"]);
export const AMOUNT_TYPES: ReadonlySet<FieldType> = new Set(["number", "currency", "percent"]);

export interface RowGroup {
  /** Composite key of the grouping values: a JSON list, so a missing value and an empty string stay apart. */
  key: string;
  /** One value per grouping field, outermost first; `null` when the row has no value. */
  values: CellValue[];
  rows: Row[];
}

export interface PreparedRows {
  /** Every row, sorted by the view's sort rules. */
  rows: Row[];
  /** One entry per group, in display order, or `null` when the view does not group. */
  groups: RowGroup[] | null;
}

/** Values are compared as text, so the number 1 and the text "1" share a group. */
export function groupKey(row: Row, keys: readonly string[]): string {
  return JSON.stringify(keys.map((key) => (row[key] === null || row[key] === undefined ? null : String(row[key]))));
}

/** Buckets rows by the composite key, in order of first appearance. */
export function groupRows(rows: readonly Row[], keys: readonly string[]): RowGroup[] {
  const groups = new Map<string, RowGroup>();
  for (const row of rows) {
    const key = groupKey(row, keys);
    const group = groups.get(key);
    if (group) group.rows.push(row);
    else groups.set(key, { key, values: keys.map((field) => row[field] ?? null), rows: [row] });
  }
  return [...groups.values()];
}

const sumOf = (rows: readonly Row[], key: string) =>
  rows.reduce((total, row) => {
    const amount = Number(row[key] ?? Number.NaN);
    return Number.isNaN(amount) ? total : total + amount;
  }, 0);

interface OrderGroupsInput {
  groups: readonly RowGroup[];
  order: GroupOrder;
  /** The grouping fields, in grouping order. */
  fields: readonly FieldDef[];
  labelFor?: LabelFor;
}

/** Orders groups by first appearance (which has no direction), name, row count or summed amount. Ties keep data order. */
export function orderGroups({ groups, order, fields, labelFor }: OrderGroupsInput): RowGroup[] {
  const { by, amountField } = order;
  if (by === "dataOrder") return [...groups];
  const sign = order.direction === "asc" ? 1 : -1;

  const byName = (a: RowGroup, b: RowGroup) => {
    for (const [level, field] of fields.entries()) {
      const result = comparatorFor(field, labelFor)(a.values[level], b.values[level]);
      if (result !== 0) return result;
    }
    return 0;
  };
  const comparators: Record<typeof by, (a: RowGroup, b: RowGroup) => number> = {
    name: byName,
    rowCount: (a, b) => a.rows.length - b.rows.length,
    amount: (a, b) => (amountField ? sumOf(a.rows, amountField) - sumOf(b.rows, amountField) : 0),
  };
  const compare = comparators[by];
  return [...groups].sort((a, b) => compare(a, b) * sign);
}

interface PrepareRowsInput {
  /** Rows after filters and search. */
  rows: readonly Row[];
  view: Pick<ViewState, "sorts" | "groupBy">;
  fields: readonly FieldDef[];
  groupOrder?: GroupOrder;
  labelFor?: LabelFor;
}

/** The rows a view shows, in pipeline order: sort, then group. Paging is left to the caller. */
export function prepareRows({ rows, view, fields, groupOrder = DEFAULT_GROUP_ORDER, labelFor }: PrepareRowsInput): PreparedRows {
  const sorted = sortRows(rows, view.sorts, fields, labelFor);
  const groupFields = view.groupBy.flatMap((key) => fields.find((field) => field.key === key) ?? []);
  if (groupFields.length === 0) return { rows: sorted, groups: null };
  const groups = groupRows(
    sorted,
    groupFields.map((field) => field.key),
  );
  return { rows: sorted, groups: orderGroups({ groups, order: groupOrder, fields: groupFields, labelFor }) };
}
