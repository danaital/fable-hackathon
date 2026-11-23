"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { DIRECTION, LOCALE_COOKIE, writePrefCookie, type Locale } from "@/lib/prefs";
import { createLocalStore } from "@/lib/store";
import { en, type I18nKey } from "./en";
import { he } from "./he";

export type { I18nKey };
type Vars = Record<string, string | number>;

/** The texts shipped with the app. Runtime overrides are merged over these. */
export const BUILT_IN_MESSAGES: Record<Locale, Readonly<Record<string, string>>> = { en, he };

/** Texts an admin added or changed at runtime, per language. An empty text counts as missing. */
export type TranslationOverrides = Record<Locale, Record<string, string>>;

const NO_OVERRIDES: TranslationOverrides = { en: {}, he: {} };
const textMap = z.record(z.string(), z.string()).catch({});

// shortcut: overrides live in this browser only (see lib/store.ts). Move to the translations table with the admin API.
export const translationOverridesStore = createLocalStore<TranslationOverrides>(
  "bahir_translations",
  z.object({ en: textMap, he: textMap }),
  NO_OVERRIDES,
);

function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

// Own properties only: a key such as "constructor" must not resolve to something inherited.
const own = (map: Readonly<Record<string, string>>, key: string): string | undefined => (Object.hasOwn(map, key) && map[key] ? map[key] : undefined);

interface Translator {
  t: (key: I18nKey, vars?: Vars) => string;
  /** For keys built from data (enum values). Returns the raw value when no label exists. */
  tData: (prefix: string, value: string) => string;
}

/** Override first, then the built-in text. `t` returns the key itself when there is no text anywhere. */
export function createTranslator(locale: Locale, overrides: TranslationOverrides = NO_OVERRIDES): Translator {
  const find = (key: string) => own(overrides[locale], key) ?? own(BUILT_IN_MESSAGES[locale], key);
  return {
    t: (key, vars) => fill(find(key) ?? key, vars),
    tData: (prefix, raw) => find(`${prefix}.${raw}`) ?? raw,
  };
}

interface I18nValue extends Translator {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const overrides = translationOverridesStore.useValue();

  const setLocale = useCallback((next: Locale) => {
    writePrefCookie(LOCALE_COOKIE, next);
    document.documentElement.lang = next;
    document.documentElement.dir = DIRECTION[next];
    setLocaleState(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ locale, dir: DIRECTION[locale], setLocale, ...createTranslator(locale, overrides) }),
    [locale, setLocale, overrides],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
