import { z } from "zod";
import type { ReportDef } from "@/data/types";
import { AGGREGATES, FILTER_RELATIONS, defaultViewState, type ViewState } from "@/features/report/viewState";

// The report has one page today. The field stays in the stored shape so a second page can come back.
export const PAGE_TYPE = "summary";
/** Query parameter that opens a report with a view applied: /report/<id>/summary?view=<id>. */
export const VIEW_PARAM = "view";
/** Query parameter that limits the "My views" page to one report. */
export const REPORT_PARAM = "report";
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 50;
export const SORT_DIRECTIONS = ["asc", "desc"] as const;
const RADIX = 36;
const SEARCH_KEY: keyof ViewState = "search";

/**
 * What a view stores: any part of the view state except the search term, which is never saved.
 * Missing parts are filled from the report's defaults.
 */
export type StoredState = Partial<Omit<ViewState, "search">>;

export interface StoredView {
  id: string;
  name: string;
  description: string;
  reportId: string;
  pageType: string;
  state: StoredState;
}

/** A view as the screens use it: user views and built-in system views in one shape, name already translated. */
export interface ViewEntry extends StoredView {
  system: boolean;
}

export const reportViewHref = (view: Pick<StoredView, "id" | "reportId">): string =>
  `/report/${encodeURIComponent(view.reportId)}/${PAGE_TYPE}?${VIEW_PARAM}=${encodeURIComponent(view.id)}`;

// randomUUID only exists on secure origins; a phone on the local network over plain http still needs an id.
export const newViewId = (): string =>
  globalThis.crypto.randomUUID?.() ?? `${Date.now().toString(RADIX)}-${Math.random().toString(RADIX).slice(2)}`;

const cellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

// Loose objects keep keys this version does not know, so a view saved by newer code survives a round trip.
const filterRuleSchema = z.looseObject({
  id: z.string(),
  field: z.string(),
  operator: z.string(),
  values: z.array(cellSchema),
  compareField: z.string().optional(),
  period: z.string().optional(),
  mandatory: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

// A part that is missing (older view) or malformed reads as "not stored" instead of rejecting the whole view.
const part = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

export const storedStateSchema: z.ZodType<StoredState> = z.looseObject({
  filters: part(z.array(filterRuleSchema)),
  relation: part(z.enum(FILTER_RELATIONS)),
  sorts: part(z.array(z.object({ key: z.string(), direction: z.enum(SORT_DIRECTIONS) }))),
  columns: part(z.array(z.string())),
  groupBy: part(z.array(z.string())),
  totals: part(z.record(z.string(), z.enum(AGGREGATES))),
  widgets: part(z.array(z.string()).nullable()),
  charts: part(z.array(z.string()).nullable()),
  pageSize: part(z.number().int().positive()),
});

export const storedViewSchema: z.ZodType<StoredView> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().catch(""),
  reportId: z.string().min(1),
  pageType: z.string().catch(PAGE_TYPE),
  state: storedStateSchema.catch({}),
});

/** One unreadable view is dropped; the rest of the list still loads. */
export const storedViewListSchema: z.ZodType<StoredView[]> = z
  .array(storedViewSchema.nullable().catch(null))
  .transform((views) => views.filter((view) => view !== null));

/**
 * Stored state → the full view state for this report. Fills parts the view does not have from the
 * report's defaults and drops references to fields the report no longer has.
 */
export function hydrateState(report: ReportDef, stored: StoredState): ViewState {
  const base = defaultViewState(report);
  const fieldKeys = new Set(report.fields.map((field) => field.key));
  const known = (key: string) => fieldKeys.has(key);
  const columns = (stored.columns ?? base.columns).filter(known);

  return {
    ...base,
    ...stored,
    filters: (stored.filters ?? base.filters).filter((rule) => known(rule.field)),
    relation: stored.relation ?? base.relation,
    // Never taken from a view (older ones may still carry it); applying a view keeps the search already typed.
    search: base.search,
    sorts: (stored.sorts ?? base.sorts).filter((rule) => known(rule.key)),
    // No columns (none stored, or all removed from the report) means "no preference": the report's own columns.
    columns: columns.length > 0 ? columns : base.columns,
    groupBy: (stored.groupBy ?? base.groupBy).filter(known),
    totals: Object.fromEntries(Object.entries(stored.totals ?? base.totals).filter(([key]) => known(key))),
    // undefined = not stored (use the default); null = show all; [] = show none.
    widgets: stored.widgets === undefined ? base.widgets : stored.widgets,
    charts: stored.charts === undefined ? base.charts : stored.charts,
    pageSize: stored.pageSize ?? base.pageSize,
  };
}

/** The part of the live state a view saves: everything but the search term. */
export function snapshotState(view: ViewState): StoredState {
  return Object.fromEntries(Object.entries(view).filter(([key]) => key !== SEARCH_KEY));
}
