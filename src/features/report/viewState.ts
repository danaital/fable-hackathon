import type { CellValue, ReportDef } from "@/data/types";
import type { SortRule } from "@/features/grid/sort";

/**
 * The single description of "how this report is being looked at".
 * Filters, the grid, the summary page, saved views, export and AI answers all read or write this object.
 */
export const FILTER_RELATIONS = ["and", "or", "flex"] as const;
export type FilterRelation = (typeof FILTER_RELATIONS)[number];

export interface FilterRule {
  id: string;
  field: string;
  /** Operator name; the filters engine owns the list of valid operators per field type. */
  operator: string;
  /** Zero, one, two or many values, depending on the operator. */
  values: CellValue[];
  /** Field-to-field comparison: compare against another field of the same row instead of `values`. */
  compareField?: string;
  /** Preset time period name (for example "last_7_days"); resolved to dates each time rows are filtered. */
  period?: string;
  /** "Required": under the "flex" relation a required rule must always match. The user can toggle it. */
  mandatory?: boolean;
  /** Disabled rules stay in the list but do not filter. Absent means enabled. */
  enabled?: boolean;
  /** `false` drops rows whose cell is empty. Absent means such rows are kept. */
  includeNoValues?: boolean;
  /** Field-to-field: how `field` and `compareField` are combined before `operator` tests the result. */
  fieldOperator?: string;
  /** Amount filters: the currency the filter value is typed in. Absent means "as shown in the table". */
  currency?: { targetCurrency?: string };
}

export const AGGREGATES = ["sum", "avg", "count", "min", "max"] as const;
export type Aggregate = (typeof AGGREGATES)[number];

export const DEFAULT_PAGE_SIZE = 25;

export interface ViewState {
  filters: FilterRule[];
  relation: FilterRelation;
  search: string;
  sorts: SortRule[];
  /** Visible field keys, in display order. */
  columns: string[];
  /** Field keys to group by, outermost first. Empty means no grouping. */
  groupBy: string[];
  /** Totals row: field key → calculation. Fields not listed show nothing. */
  totals: Record<string, Aggregate>;
  /** Widget ids to show. `null` shows all; an empty list shows none. */
  widgets: string[] | null;
  /** Chart ids to show. `null` shows all; an empty list shows none. */
  charts: string[] | null;
  pageSize: number;
}

export function defaultViewState(report: ReportDef): ViewState {
  return {
    filters: [],
    relation: "and",
    search: "",
    sorts: [],
    columns: report.fields.map((field) => field.key),
    groupBy: [],
    totals: {},
    widgets: null,
    charts: null,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}
