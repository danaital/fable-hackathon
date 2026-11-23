export const LOCALES = ["en", "he"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const DIRECTION: Record<Locale, "ltr" | "rtl"> = { en: "ltr", he: "rtl" };

export const THEME_MODES = ["light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export const DEFAULT_MODE: ThemeMode = "light";

export const LOCALE_COOKIE = "bahir_locale";
export const MODE_COOKIE = "bahir_mode";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function parseLocale(value: string | undefined): Locale {
  return LOCALES.find((l) => l === value) ?? DEFAULT_LOCALE;
}

export function parseMode(value: string | undefined): ThemeMode {
  return THEME_MODES.find((m) => m === value) ?? DEFAULT_MODE;
}

// Preference cookies only (no secrets), so they are readable by the server layout.
export function writePrefCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
