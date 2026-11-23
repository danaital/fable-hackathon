"use client";

import { z } from "zod";
import { createLocalStore } from "@/lib/store";
import { stableStringify } from "./logic";
import { storedViewListSchema, type StoredView } from "./model";

// shortcut: views and view preferences live in this browser only (no login or database yet).
// Upgrade: back these functions with per-user database rows; the screens only use this module.

/** Per-user choices kept outside the views themselves. Default and last used are one view id per report. */
const prefsSchema = z.object({
  defaults: z.record(z.string(), z.string()).catch({}),
  lastUsed: z.record(z.string(), z.string()).catch({}),
  favorites: z.array(z.string()).catch([]),
});
export type ViewPrefs = z.infer<typeof prefsSchema>;

const NO_VIEWS: StoredView[] = [];
const NO_PREFS: ViewPrefs = { defaults: {}, lastUsed: {}, favorites: [] };

const viewsStore = createLocalStore("bahir_views", storedViewListSchema, NO_VIEWS);
const prefsStore = createLocalStore("bahir_view_prefs", prefsSchema, NO_PREFS);

const without = (map: Record<string, string>, key: string) => Object.fromEntries(Object.entries(map).filter(([other]) => other !== key));
const withoutValue = (map: Record<string, string>, value: string) =>
  Object.fromEntries(Object.entries(map).filter(([, other]) => other !== value));

function list(): StoredView[] {
  return viewsStore.read();
}

function get(id: string): StoredView | undefined {
  return list().find((view) => view.id === id);
}

/** Creates or replaces a view. Returns false when the browser refused to store it, so the caller can say so. */
function save(view: StoredView): boolean {
  viewsStore.write([...list().filter((other) => other.id !== view.id), view]);
  return stableStringify(get(view.id)) === stableStringify(view);
}

/** Saves a view with the "set as my default" choice: ticked sets it, unticked clears it when this view was the default. */
function saveWithDefault(view: StoredView, makeDefault: boolean): boolean {
  if (!save(view)) return false;
  if (makeDefault) setDefault(view.reportId, view.id);
  else if (prefsStore.read().defaults[view.reportId] === view.id) setDefault(view.reportId, null);
  return true;
}

/** Deletes a view and every preference that points at it. */
function remove(id: string): boolean {
  viewsStore.write(list().filter((view) => view.id !== id));
  if (get(id)) return false;
  const prefs = prefsStore.read();
  prefsStore.write({
    defaults: withoutValue(prefs.defaults, id),
    lastUsed: withoutValue(prefs.lastUsed, id),
    favorites: prefs.favorites.filter((other) => other !== id),
  });
  return true;
}

/** Sets the user's default view for a report; `null` clears it. */
function setDefault(reportId: string, viewId: string | null): void {
  const prefs = prefsStore.read();
  const defaults = viewId ? { ...prefs.defaults, [reportId]: viewId } : without(prefs.defaults, reportId);
  prefsStore.write({ ...prefs, defaults });
}

function setLastUsed(reportId: string, viewId: string): void {
  const prefs = prefsStore.read();
  if (prefs.lastUsed[reportId] === viewId) return;
  prefsStore.write({ ...prefs, lastUsed: { ...prefs.lastUsed, [reportId]: viewId } });
}

function toggleFavorite(viewId: string): void {
  const prefs = prefsStore.read();
  const favorites = prefs.favorites.includes(viewId) ? prefs.favorites.filter((id) => id !== viewId) : [...prefs.favorites, viewId];
  prefsStore.write({ ...prefs, favorites });
}

export const viewsRepository = {
  list,
  get,
  save,
  saveWithDefault,
  remove,
  prefs: prefsStore.read,
  setDefault,
  setLastUsed,
  toggleFavorite,
  /** React hooks: current values, re-rendering on change (also from other tabs). */
  useList: viewsStore.useValue,
  usePrefs: prefsStore.useValue,
};
