"use client";

import { useSyncExternalStore } from "react";
import type { ImportKind } from "./configImport";
import type { UndoResult } from "./configStore";

export type ImportTarget = ImportKind | "translations";

export interface LastImport {
  target: ImportTarget;
  /** Null for translations, which belong to no report. */
  reportId: string | null;
  undo: () => UndoResult;
}

// shortcut: kept in memory, so "Undo last import" is gone after a page reload;
// keep it with the import audit record once imports run on the server.
let last: LastImport | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const lastImportStore = {
  set(value: LastImport | null): void {
    last = value;
    listeners.forEach((listener) => listener());
  },
  useValue: (): LastImport | null => useSyncExternalStore(subscribe, () => last, () => null),
};
