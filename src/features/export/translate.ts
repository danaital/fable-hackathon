import { en, type I18nKey } from "@/i18n/en";
import { he } from "@/i18n/he";
import type { Locale } from "@/lib/prefs";

type Vars = Record<string, string | number>;
export type Translate = (key: I18nKey, vars?: Vars) => string;
export type TranslateData = (prefix: string, value: string) => string;

const DICTIONARIES: Record<Locale, Record<I18nKey, string>> = { en, he };
const isKey = (key: string): key is I18nKey => key in en;

/** The file's language can differ from the app's, so the generator translates with its own dictionary. */
export function translatorFor(locale: Locale): { t: Translate; tData: TranslateData } {
  const dict = DICTIONARIES[locale];
  return {
    t: (key, vars) => dict[key].replace(/\{(\w+)\}/g, (match, name: string) => (vars && name in vars ? String(vars[name]) : match)),
    tData: (prefix, value) => {
      const key = `${prefix}.${value}`;
      return isKey(key) ? dict[key] : value;
    },
  };
}
