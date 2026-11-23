"use client";

import { useSyncExternalStore } from "react";

/** The column layout being edited in the columns panel, shown live in the grid behind it. */
export interface ColumnsPreview {
  reportId: string;
  columns: string[];
  /** The column being moved; the grid marks it with a tint and side borders. */
  highlight: string | null;
}

// The columns button lives in the data toolbar and the grid below it, with no shared parent this feature owns,
// so the preview travels through this small module store instead of a context.
let preview: ColumnsPreview | null = null;
const listeners = new Set<() => void>();

export function setColumnsPreview(next: ColumnsPreview | null): void {
  preview = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useColumnsPreview(reportId: string): ColumnsPreview | null {
  const current = useSyncExternalStore(
    subscribe,
    () => preview,
    () => null,
  );
  return current?.reportId === reportId ? current : null;
}
