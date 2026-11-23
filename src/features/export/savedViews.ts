"use client";

import { useMemo } from "react";
import { z } from "zod";
import type { ReportDef } from "@/data/types";
import type { SortRule } from "@/features/grid/sort";
import { FILTER_RELATIONS, type FilterRelation, type FilterRule } from "@/features/report/viewState";
import { createLocalStore } from "@/lib/store";
import { filterRuleSchema, sortRuleSchema } from "./schema";

// Adapter: the views feature owns these two storage keys. Export only reads them, validates what it
// reads, and treats anything it cannot read as "no saved views".
const VIEWS_KEY = "bahir_views";
const VIEW_PREFS_KEY = "bahir_view_prefs";

/** The part of a view (or of an export template) that an export can take over. */
export interface Definition {
  name: string;
  filters: FilterRule[];
  relation: FilterRelation;
  sorts: SortRule[];
  columns: string[];
}

export interface SavedView extends Definition {
  id: string;
}

const part = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const storedViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  reportId: z.string().min(1),
  state: z
    .object({
      filters: part(z.array(filterRuleSchema)),
      relation: part(z.enum(FILTER_RELATIONS)),
      sorts: part(z.array(sortRuleSchema)),
      columns: part(z.array(z.string())),
    })
    .catch({}),
});
type StoredView = z.infer<typeof storedViewSchema>;

// One unreadable view is dropped; the rest of the list still loads.
const listSchema = z.array(storedViewSchema.nullable().catch(null)).transform((views) => views.filter((view) => view !== null));
const prefsSchema = z.object({ lastUsed: z.record(z.string(), z.string()).catch({}) });

const NO_VIEWS: StoredView[] = [];
const viewsStore = createLocalStore<StoredView[]>(VIEWS_KEY, listSchema, NO_VIEWS);
const prefsStore = createLocalStore(VIEW_PREFS_KEY, prefsSchema, { lastUsed: {} });

/** Stored view → definition, dropping fields the report no longer has. */
export function toSavedView(report: ReportDef, { id, name, state }: StoredView): SavedView {
  const known = new Set(report.fields.map((field) => field.key));
  return {
    id,
    name,
    filters: (state.filters ?? []).filter((rule) => known.has(rule.field)),
    relation: state.relation ?? "and",
    sorts: (state.sorts ?? []).filter((rule) => known.has(rule.key)),
    columns: (state.columns ?? []).filter((key) => known.has(key)),
  };
}

/** The saved views of one report, by name. */
export function viewsOfReport(report: ReportDef, stored: readonly StoredView[]): SavedView[] {
  return stored
    .filter((view) => view.reportId === report.id)
    .map((view) => toSavedView(report, view))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** React hook: this report's saved views, and the id of the saved view the page is showing (or null). */
export function useSavedViews(report: ReportDef): { savedViews: SavedView[]; currentViewId: string | null } {
  const stored = viewsStore.useValue();
  // shortcut: reads the views feature's "last used" preference because the report context does not
  // expose the selected view; switch to that as soon as it does.
  const { lastUsed } = prefsStore.useValue();
  const savedViews = useMemo(() => viewsOfReport(report, stored), [report, stored]);
  return { savedViews, currentViewId: lastUsed[report.id] ?? null };
}
