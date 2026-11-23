import { describe, expect, it } from "vitest";
import { THEME_MODES } from "@/lib/prefs";
import { THEMES } from "@/styles/theme";
import { SORT_PALETTE, sortLevelStyle } from "./sortPalette";

const AA = 4.5;
const LEVELS = 8;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

describe("sort palette", () => {
  it.each(THEME_MODES)("has eight distinct levels in the %s theme", (mode) => {
    expect(SORT_PALETTE[mode]).toHaveLength(LEVELS);
    expect(new Set(SORT_PALETTE[mode].map((step) => step.badge)).size).toBe(LEVELS);
  });

  it.each(THEME_MODES)("keeps AA contrast for badge text and for cell text on the tint in the %s theme", (mode) => {
    const { text, textMuted } = THEMES[mode].color;
    for (const step of SORT_PALETTE[mode]) {
      expect(contrast(step.badge, step.onBadge)).toBeGreaterThanOrEqual(AA);
      expect(contrast(step.tint, text)).toBeGreaterThanOrEqual(AA);
      expect(contrast(step.tint, textMuted)).toBeGreaterThanOrEqual(AA);
    }
  });

  it("gets lighter in weight every two levels and repeats the last level", () => {
    expect(SORT_PALETTE.light.map((step) => step.weight)).toEqual([700, 700, 600, 600, 500, 500, 400, 400]);
    expect(sortLevelStyle("light", 20)).toBe(SORT_PALETTE.light[LEVELS - 1]);
  });
});
