"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n";
import { PAGE_TYPE, type ViewEntry } from "./model";
import { viewsRepository } from "./repository";
import { SYSTEM_ID_PREFIX, SYSTEM_VIEWS } from "./systemViews";

interface ViewsValue {
  /** System views (names in the current language) followed by the user's views, for every report. */
  views: ViewEntry[];
  /** Report id → the user's default view id. */
  defaults: Record<string, string>;
  /** Report id → the view the user picked last. */
  lastUsed: Record<string, string>;
  favorites: ReadonlySet<string>;
}

export function useViews(): ViewsValue {
  const { t } = useI18n();
  const stored = viewsRepository.useList();
  const prefs = viewsRepository.usePrefs();

  const views = useMemo<ViewEntry[]>(
    () => [
      ...SYSTEM_VIEWS.map(({ id, reportId, nameKey, descKey, state }) => ({
        id,
        reportId,
        pageType: PAGE_TYPE,
        name: t(nameKey),
        description: t(descKey),
        state,
        system: true,
      })),
      // Stored data is untrusted: a stored view may never pose as a system view.
      ...stored.filter((view) => !view.id.startsWith(SYSTEM_ID_PREFIX)).map((view) => ({ ...view, system: false })),
    ],
    [stored, t],
  );
  const favorites = useMemo(() => new Set(prefs.favorites), [prefs.favorites]);

  return { views, defaults: prefs.defaults, lastUsed: prefs.lastUsed, favorites };
}
