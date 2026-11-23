"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { windowRange } from "./paging";

const ESTIMATED_ROW_HEIGHT = 53;
const OVERSCAN_ROWS = 5;
const ROWS_BEFORE_MEASURE = 50;
const MIN_SCROLL_STEP = 10;
/** Body rows carry this attribute so the hook can measure a real row. */
export const ROW_MARK = "data-grid-row";

interface RowWindow {
  /** Attach to the scroll container. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Rows to render: `start` inclusive, `end` exclusive. */
  start: number;
  end: number;
  rowHeight: number;
}

/** Windowed rendering for long pages: only the rows near the viewport are in the DOM. */
export function useRowWindow(rows: readonly unknown[], enabled: boolean): RowWindow {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(ESTIMATED_ROW_HEIGHT);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [seenRows, setSeenRows] = useState(rows);

  // A new page, sort or filter starts again from the top.
  if (seenRows !== rows) {
    setSeenRows(rows);
    setScrollTop(0);
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [rows]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!enabled || !element) return;
    let frame = 0;
    let last = element.scrollTop;
    const measure = () => {
      setViewportHeight(element.clientHeight);
      const height = element.querySelector(`[${ROW_MARK}]`)?.getBoundingClientRect().height;
      if (height) setRowHeight(height);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (Math.abs(element.scrollTop - last) < MIN_SCROLL_STEP) return;
        last = element.scrollTop;
        setScrollTop(last);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled) return { scrollRef, start: 0, end: rows.length, rowHeight };
  if (viewportHeight === 0) return { scrollRef, start: 0, end: Math.min(rows.length, ROWS_BEFORE_MEASURE), rowHeight };
  return { scrollRef, rowHeight, ...windowRange({ scrollTop, viewportHeight, rowHeight, count: rows.length, overscan: OVERSCAN_ROWS }) };
}
