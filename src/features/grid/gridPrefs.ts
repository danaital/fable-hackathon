"use client";

import { useCallback } from "react";
import { z } from "zod";
import { createLocalStore } from "@/lib/store";
import { DEFAULT_GROUP_ORDER, GROUP_ORDERS } from "./prepare";
import { EXTRA_KINDS } from "./totals";

// shortcut: grid state the shared ViewState cannot hold yet (extra calculations, group order) lives here,
// per browser and per report, so saved views do not carry it. Move both into ViewState when it gains the fields.
const prefsSchema = z.object({
  extraTotals: z.record(z.string(), z.enum(EXTRA_KINDS)),
  /** The user has chosen totals for this report, so the default totals no longer apply. */
  totalsCustomized: z.boolean().optional(),
  groupOrder: z.object({ by: z.enum(GROUP_ORDERS), direction: z.enum(["asc", "desc"]), amountField: z.string().optional() }),
});
export type GridPrefs = z.infer<typeof prefsSchema>;

const DEFAULT_PREFS: GridPrefs = { extraTotals: {}, groupOrder: DEFAULT_GROUP_ORDER };
const EMPTY: Record<string, GridPrefs> = {};
const store = createLocalStore("bahir_grid_prefs", z.record(z.string(), prefsSchema), EMPTY);

/** Per-report grid preferences: extra calculations and group order. Totals position and the pinned header are user settings. */
export function useGridPrefs(reportId: string): [GridPrefs, (patch: Partial<GridPrefs>) => void] {
  const prefs = store.useValue()[reportId] ?? DEFAULT_PREFS;
  const update = useCallback(
    (patch: Partial<GridPrefs>) => {
      const all = store.read();
      store.write({ ...all, [reportId]: { ...(all[reportId] ?? DEFAULT_PREFS), ...patch } });
    },
    [reportId],
  );
  return [prefs, update];
}
