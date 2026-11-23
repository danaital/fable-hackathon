"use client";

import { BUILT_IN_SUMMARY, FALLBACK_WIDGET } from "@/data/summary";
import { resolveSummaryConfig, summaryConfigStore } from "@/features/summary/summaryConfig";
import { newViewId } from "@/features/views/model";
import { viewsRepository } from "@/features/views/repository";
import type { Locale } from "@/lib/prefs";
import { stableStringify, type ImportContext, type ReportConfig } from "./configImport";
import { mergeSections, modelSections } from "./configModel";
import type { PortableView } from "./model";
import { dataModelRepository } from "./repository";

// Where a report's configuration lives today: summary overrides, the admin data model and the saved views.
// shortcut: three browser stores written one after the other with a read-back check and an undo;
// upgrade to one database transaction behind POST /api/admin/reports/{id}/config/import.

const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

function reportViews(reportId: string) {
  return viewsRepository.list().filter((view) => view.reportId === reportId);
}

/** The current configuration of one report: the comparison baseline for an import, and what an export writes. */
export function loadReportConfig(reportId: string): ReportConfig {
  const summary = resolveSummaryConfig(reportId, summaryConfigStore.read());
  return {
    ...modelSections(dataModelRepository.read(), reportId),
    widgets: summary.widgets.filter((widget) => widget !== FALLBACK_WIDGET),
    charts: summary.charts,
    views: reportViews(reportId).map(({ name, description, pageType, state }): PortableView => ({ name, description, pageType, state })),
  };
}

/** Imports may only attach to entities that exist and are active. */
export function importContext(locale: Locale): ImportContext {
  const active = dataModelRepository.read().entities.filter((entity) => entity.isActive);
  return { locale, entities: new Map(active.map((entity) => [entity.key, new Set(entity.columns.map((column) => column.name))])) };
}

/** The three stores at one moment, for one report. Views are sorted because saving one moves it to the end of the list. */
function snapshot(reportId: string) {
  return {
    overrides: summaryConfigStore.read(),
    model: dataModelRepository.read(),
    views: reportViews(reportId).sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
}
type Snapshot = ReturnType<typeof snapshot>;

function restore(reportId: string, target: Snapshot): void {
  summaryConfigStore.write(target.overrides);
  dataModelRepository.write(target.model);
  reportViews(reportId)
    .filter((view) => !target.views.some((other) => other.id === view.id))
    .forEach((view) => viewsRepository.remove(view.id));
  target.views.forEach((view) => viewsRepository.save(view));
}

/** What "Undo last import" needs: the report's stores before the import, and after it to notice later edits. */
export interface ImportUndo {
  reportId: string;
  before: Snapshot;
  after: Snapshot;
}
export type UndoResult = "undone" | "changed" | "failed";

/** Stores a checked configuration. All of it, or (when the browser refuses a write) none of it and null. */
export function applyReportConfig(reportId: string, next: ReportConfig): ImportUndo | null {
  const before = snapshot(reportId);
  const { overrides, model, views } = before;
  const builtIn = BUILT_IN_SUMMARY[reportId];

  // A list equal to the built-in one is left out, so it keeps following the code.
  const nextOverrides = {
    ...overrides,
    [reportId]: {
      ...(same(next.widgets, builtIn?.widgets ?? []) ? {} : { widgets: next.widgets }),
      ...(same(next.charts, builtIn?.charts ?? []) ? {} : { charts: next.charts }),
    },
  };
  const nextModel = mergeSections({ model, reportId, next });
  summaryConfigStore.write(nextOverrides);
  dataModelRepository.write(nextModel);
  const viewsSaved = next.views.every((view) => {
    const existing = views.find((other) => other.name === view.name);
    const unchanged = existing && same({ ...view }, { name: existing.name, description: existing.description, pageType: existing.pageType, state: existing.state });
    return unchanged || viewsRepository.save({ ...view, id: existing?.id ?? newViewId(), reportId });
  });

  const stored = viewsSaved && same(summaryConfigStore.read(), nextOverrides) && same(dataModelRepository.read(), nextModel);
  if (stored) return { reportId, before, after: snapshot(reportId) };
  restore(reportId, before);
  return null;
}

/** Puts the stores back as they were before the import. Refused when anything changed since, so later edits are never lost. */
export function undoReportImport({ reportId, before, after }: ImportUndo): UndoResult {
  if (!same(snapshot(reportId), after)) return "changed";
  restore(reportId, before);
  return same(snapshot(reportId), before) ? "undone" : "failed";
}
