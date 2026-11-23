import type { ThemeMode } from "@/lib/prefs";

interface Tone {
  bg: string;
  fg: string;
}

export interface AppColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  focus: string;
  success: Tone;
  warning: Tone;
  danger: Tone;
  info: Tone;
  neutral: Tone;
}

export type ToneName = "success" | "warning" | "danger" | "info" | "neutral";

const space = { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px", xxl: "40px" } as const;
const fontSize = { xs: "12px", sm: "13px", md: "15px", lg: "18px", xl: "22px", xxl: "28px" } as const;
const font = {
  family: 'var(--font-latin), var(--font-hebrew), system-ui, sans-serif',
  size: fontSize,
  weight: { regular: 400, medium: 500 },
} as const;
const radius = { sm: "4px", md: "8px", lg: "12px" } as const;
const size = { control: "36px", touch: "44px", content: "1280px", toast: "380px", card: "120px", chart: "280px" } as const;
// Offsets are vertical only, so the shadow needs no mirrored version in RTL.
const shadow = { md: "0 4px 16px rgb(0 0 0 / 0.18)" } as const;
// Breakpoints: below `mobile` is phone layout, below `tablet` is compact layout.
const bp = { mobile: "640px", tablet: "960px" } as const;

const base = { space, font, radius, size, shadow, bp };

export interface AppTheme {
  mode: ThemeMode;
  color: AppColors;
  space: typeof space;
  font: typeof font;
  radius: typeof radius;
  size: typeof size;
  shadow: typeof shadow;
  bp: typeof bp;
}

export const lightTheme: AppTheme = {
  mode: "light",
  color: {
    bg: "#FAF8F3",
    surface: "#FFFFFF",
    surfaceAlt: "#F2EEE4",
    text: "#14213D",
    textMuted: "#4A5568",
    border: "#D9D4C7",
    primary: "#14213D",
    onPrimary: "#FAF8F3",
    accent: "#F5A300",
    onAccent: "#14213D",
    focus: "#1D4ED8",
    success: { bg: "#DDF1E8", fg: "#14573F" },
    warning: { bg: "#FBE8D0", fg: "#7A3A06" },
    danger: { bg: "#F9DEDC", fg: "#7A1A14" },
    info: { bg: "#DEE8FB", fg: "#1E3A8A" },
    neutral: { bg: "#ECE8DD", fg: "#3A4354" },
  },
  ...base,
};

export const darkTheme: AppTheme = {
  mode: "dark",
  color: {
    bg: "#0E1628",
    surface: "#17223B",
    surfaceAlt: "#1E2B49",
    text: "#F2EFE6",
    textMuted: "#B8C0D0",
    border: "#2C3A57",
    primary: "#F2EFE6",
    onPrimary: "#0E1628",
    accent: "#F5A300",
    onAccent: "#14213D",
    focus: "#8AB4FF",
    success: { bg: "#123F31", fg: "#9EE0C4" },
    warning: { bg: "#4A2A08", fg: "#F7C98B" },
    danger: { bg: "#4E1612", fg: "#F5B5B0" },
    info: { bg: "#1B2F5E", fg: "#B7CBF7" },
    neutral: { bg: "#26334F", fg: "#C9D1E0" },
  },
  ...base,
};

export const THEMES: Record<ThemeMode, AppTheme> = { light: lightTheme, dark: darkTheme };
