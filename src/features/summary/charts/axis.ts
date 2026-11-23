import type { ChartType } from "../config";
import type { Unit } from "../values";

// Pure layout rules of the chart axes: how long a tick label may be, when labels tilt, how numbers are shortened.

/** Longest category tick label; the full text stays in the tooltip, the legend and the table. */
export const MAX_TICK_CHARS = 14;
const ELLIPSIS = "…";
/** Characters that fit side by side along the category axis of the narrowest card. */
const LEVEL_CHAR_BUDGET = 44;
const PERCENT = 100;
const CARD_HEIGHT = 280;
const ENLARGED_HEIGHT = 440;
/** A horizontal bar chart grows with its rows instead of squeezing them. */
const ROW_HEIGHT = 26;
const ROWS_CHROME = 40;
const MAX_ROWS_HEIGHT = 560;

export function shortLabel(text: string, max: number = MAX_TICK_CHARS): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}${ELLIPSIS}`;
}

/** True when the labels, already shortened, cannot sit level next to each other. */
export function needsTilt(labels: readonly string[]): boolean {
  const longest = Math.max(0, ...labels.map((label) => shortLabel(label).length));
  return labels.length * (longest + 1) > LEVEL_CHAR_BUDGET;
}

const COMPACT: Intl.NumberFormatOptions = { notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 };

/** Short numbers for axis ticks and on-chart labels ("1.2K", "$15K", "17%"); the exact value is in the tooltip and the table. */
export function compactFormatter(locale: string, unit: Unit): (value: number) => string {
  const plain = new Intl.NumberFormat(locale, COMPACT);
  if (unit.type === "percent") {
    const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
    // Percent values are stored as whole numbers (15 means 15%).
    return (value) => percent.format(value / PERCENT);
  }
  if (unit.type !== "currency" || !unit.currency) return (value) => plain.format(value);
  try {
    const money = new Intl.NumberFormat(locale, { ...COMPACT, style: "currency", currency: unit.currency });
    return (value) => money.format(value);
  } catch {
    return (value) => plain.format(value); // a malformed currency code must not break the chart
  }
}

interface HeightInput {
  type: ChartType;
  /** Visible categories. */
  categories: number;
  /** True for the copy inside the enlarge dialog. */
  enlarged: boolean;
}

export function chartHeight({ type, categories, enlarged }: HeightInput): number {
  const base = enlarged ? ENLARGED_HEIGHT : CARD_HEIGHT;
  if (type !== "horizontalBar") return base;
  return Math.min(Math.max(base, categories * ROW_HEIGHT + ROWS_CHROME), Math.max(base, MAX_ROWS_HEIGHT));
}
