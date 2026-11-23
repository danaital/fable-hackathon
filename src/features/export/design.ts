// Readability check for a styling choice, after the WCAG 2 contrast formula.

/** Below this, text on its background is hard to read (WCAG AA for normal text). */
export const MIN_CONTRAST = 4.5;
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const CHANNEL_MAX = 255;
// sRGB to linear light, as the WCAG definition of relative luminance gives it.
const LINEAR_LIMIT = 0.03928;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_SCALE = 1.055;
const GAMMA = 2.4;
const RED = 0.2126;
const GREEN = 0.7152;
const BLUE = 0.0722;
const FLARE = 0.05;
const HEX_BASE = 16;
const CHANNEL_STARTS = [1, 3, 5] as const;

function luminance(hex: string): number {
  const [red, green, blue] = CHANNEL_STARTS.map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), HEX_BASE) / CHANNEL_MAX;
    return channel <= LINEAR_LIMIT ? channel / LINEAR_DIVISOR : ((channel + GAMMA_OFFSET) / GAMMA_SCALE) ** GAMMA;
  });
  return RED * red + GREEN * green + BLUE * blue;
}

/** Contrast between two `#rrggbb` colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + FLARE) / (dark + FLARE);
}
