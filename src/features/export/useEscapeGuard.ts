"use client";

import { useEffect, useRef, type RefObject } from "react";

interface Input {
  /** Any element inside the dialog; the dialog is found from it. */
  anchor: RefObject<HTMLElement | null>;
  /** Whether the dialog is open (its content, and so the anchor, only exists while it is). */
  active: boolean;
  onEscape: () => void;
}

/**
 * The shared Dialog closes on Escape by itself. A dialog that must ask first, or must stay open while
 * an export runs, takes over the key here: the close is stopped and `onEscape` decides what happens.
 */
export function useEscapeGuard({ anchor, active, onEscape }: Input): void {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const dialog = anchor.current?.closest("dialog");
    const onCancel = (event: Event) => {
      if (event.target !== dialog) return; // a dialog opened on top handles its own Escape
      event.preventDefault();
      handler.current();
    };
    dialog?.addEventListener("cancel", onCancel);
    return () => dialog?.removeEventListener("cancel", onCancel);
  }, [anchor, active]);
}
