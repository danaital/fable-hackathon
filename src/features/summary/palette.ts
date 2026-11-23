import { pattern, patterns, type RechartsFill, type SymbolType } from "recharts";
import type { ThemeMode } from "@/lib/prefs";

/**
 * Colorblind-safe categorical colors (Okabe-Ito and Paul Tol hues), tuned per theme so every color keeps
 * at least 3:1 contrast against the card surface. Color is never the only cue: each slot also has its own
 * fill pattern, line dash and point shape.
 */
export const CHART_COLORS: Record<ThemeMode, readonly string[]> = {
  light: ["#0072B2", "#C24E00", "#117733", "#AA4499", "#332288", "#882255", "#7A6200", "#555555"],
  dark: ["#56B4E9", "#E69F00", "#44BB99", "#EE99CC", "#F0E442", "#FF8866", "#BBAAFF", "#CCCCCC"],
};

// Defined once at module level: a new definition component on every render would redraw the pattern every time.
const PATTERN_DEFINITIONS = [
  null,
  pattern(patterns.diagonal),
  pattern(patterns.dots),
  pattern(patterns.horizontal),
  pattern(patterns.crosshatch),
  pattern(patterns.vertical),
  pattern(patterns.zigzag),
  pattern(patterns.grid),
] as const;
const DASHES = ["", "8 4", "2 4", "10 4 2 4", "6 2", "1 3", "12 3", "4 4 1 4"] as const;
const SYMBOLS: readonly SymbolType[] = ["circle", "square", "triangle", "diamond", "cross", "star", "wye", "circle"];

export const SLOT_COUNT = PATTERN_DEFINITIONS.length;

export interface SeriesStyle {
  color: string;
  /** Solid color for the first slot, the color under a texture for the others. */
  fill: string | RechartsFill;
  dash: string;
  symbol: SymbolType;
}

export function seriesStyle(slot: number, mode: ThemeMode): SeriesStyle {
  const color = CHART_COLORS[mode][slot % CHART_COLORS[mode].length];
  const definition = PATTERN_DEFINITIONS[slot % SLOT_COUNT];
  return { color, fill: definition ? { color, definition } : color, dash: DASHES[slot % DASHES.length], symbol: SYMBOLS[slot % SYMBOLS.length] };
}

const HASH_MULTIPLIER = 31;

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * HASH_MULTIPLIER + (char.codePointAt(0) ?? 0)) >>> 0;
  return value;
}

/**
 * A style slot per key, from a hash of the key, so a series or slice keeps its look when filters change the data.
 * Two keys that hash to the same slot are separated: the later one takes the next free slot.
 */
export function assignSlots(keys: readonly string[], slotCount: number = SLOT_COUNT): number[] {
  const taken = new Set<number>();
  return keys.map((key) => {
    let slot = hash(key) % slotCount;
    for (let tries = 0; tries < slotCount && taken.has(slot); tries += 1) slot = (slot + 1) % slotCount;
    taken.add(slot);
    return slot;
  });
}
