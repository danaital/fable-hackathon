import type { ThemeMode } from "@/lib/prefs";

export interface SortLevelStyle {
  /** Badge background. */
  badge: string;
  /** Badge text; at least 4.5:1 against `badge`. */
  onBadge: string;
  /** Background of the sorted column's cells; the theme's text colors keep 4.5:1 on it. */
  tint: string;
  weight: number;
}

// Bold for the first two priorities, then one step lighter every two positions.
const WEIGHTS = [700, 700, 600, 600, 500, 500, 400, 400] as const;
const ON_LIGHT_BADGE = "#FFFFFF";
const ON_DARK_BADGE = "#0E1628";

const level = (colors: readonly (readonly [badge: string, tint: string])[], onBadge: string): SortLevelStyle[] =>
  colors.map(([badge, tint], index) => ({ badge, onBadge, tint, weight: WEIGHTS[index] }));

/**
 * One color and weight per sort priority, for the header badge and the sorted column's tint.
 * The priority number and the direction icon carry the meaning; color and weight only reinforce it.
 * Contrast is checked in sortPalette.test.ts.
 */
export const SORT_PALETTE: Record<ThemeMode, readonly SortLevelStyle[]> = {
  light: level(
    [
      ["#1D4ED8", "#DCE7FD"],
      ["#B91C1C", "#FBE0E0"],
      ["#047857", "#D6F1E6"],
      ["#7E22CE", "#EDDDFA"],
      ["#A14A08", "#FAE8CE"],
      ["#0E7490", "#D4EEF4"],
      ["#BE185D", "#FADDE9"],
      ["#4B5563", "#E5E7EB"],
    ],
    ON_LIGHT_BADGE,
  ),
  dark: level(
    [
      ["#8AB4FF", "#1B2F5E"],
      ["#FCA5A5", "#4E1A1A"],
      ["#6EE7B7", "#123F31"],
      ["#D8B4FE", "#3B2460"],
      ["#FCD34D", "#4A3508"],
      ["#67E8F9", "#0F3D47"],
      ["#F9A8D4", "#4A1B33"],
      ["#CBD5E1", "#2F3A4F"],
    ],
    ON_DARK_BADGE,
  ),
};

/** Style of a zero-based sort priority. Past the last step the last one repeats. */
export function sortLevelStyle(mode: ThemeMode, priority: number): SortLevelStyle {
  const steps = SORT_PALETTE[mode];
  return steps[Math.min(priority, steps.length - 1)];
}
