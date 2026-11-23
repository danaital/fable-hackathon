import { z } from "zod";
import { BUILT_IN_MESSAGES, type TranslationOverrides } from "@/i18n";
import { LOCALES, type Locale } from "@/lib/prefs";
import { ZOD_MESSAGES, fromZod, type FileError, type ItemStatus, type PlanIssue } from "./configImport";
import { NAME_MAX, TEXT_MAX, type Result } from "./model";

// The translation table, its edits and its JSON file. Pure: the screens write the result to `translationOverridesStore`.

export const TRANSLATION_KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;
/** Above the number of built-in keys, so a full export imports back. The 5 MB cap on the file still applies. */
export const MAX_TRANSLATION_ITEMS = 10000;
const KEY_SEPARATOR = ".";
// A key segment with one of these names could reach an object's prototype once keys become a nested bundle.
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

export interface TranslationRow {
  key: string;
  en: string;
  he: string;
  /** Shipped with the app: it can be reset but not deleted. */
  builtIn: boolean;
  /** An admin changed or added it. */
  changed: boolean;
}

type Texts = Partial<Record<Locale, string>>;

// Own properties only; an empty text counts as missing, as in the translator.
const own = (map: Readonly<Record<string, string>>, key: string): string => (Object.hasOwn(map, key) ? map[key] : "");

/** Every key with the text the app shows for it, sorted by key. */
export function translationRows(overrides: TranslationOverrides): TranslationRow[] {
  const keys = new Set(LOCALES.flatMap((locale) => [...Object.keys(BUILT_IN_MESSAGES[locale]), ...Object.keys(overrides[locale])]));
  return [...keys]
    .sort()
    .map((key) => ({
      key,
      en: own(overrides.en, key) || own(BUILT_IN_MESSAGES.en, key),
      he: own(overrides.he, key) || own(BUILT_IN_MESSAGES.he, key),
      builtIn: LOCALES.some((locale) => own(BUILT_IN_MESSAGES[locale], key) !== ""),
      changed: LOCALES.some((locale) => own(overrides[locale], key) !== ""),
    }))
    .filter((row) => row.en !== "" || row.he !== "");
}

export const isUntranslated = (row: TranslationRow): boolean => !row.he.trim() || row.he.trim() === row.en.trim();

export function filterRows(rows: readonly TranslationRow[], { query, untranslatedOnly }: { query: string; untranslatedOnly: boolean }): TranslationRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => row.key.toLowerCase().includes(needle) && (!untranslatedOnly || isUntranslated(row)));
}

/** The format of a new key. Keys shipped with the app are accepted as they are (one has a slash in it). */
export function isTranslationKey(key: string): boolean {
  const wellFormed = key.length <= NAME_MAX && TRANSLATION_KEY_PATTERN.test(key) && !key.split(KEY_SEPARATOR).some((segment) => FORBIDDEN_SEGMENTS.has(segment));
  return wellFormed || LOCALES.some((locale) => own(BUILT_IN_MESSAGES[locale], key) !== "");
}

/** The given languages laid over the overrides. A text equal to the built-in one is not stored, so it keeps following the code. */
function withTexts(overrides: TranslationOverrides, changes: readonly (readonly [key: string, texts: Texts])[]): TranslationOverrides {
  const next: TranslationOverrides = { en: { ...overrides.en }, he: { ...overrides.he } };
  for (const [key, texts] of changes) {
    for (const locale of LOCALES) {
      const text = texts[locale];
      if (text === undefined) continue;
      if (text === own(BUILT_IN_MESSAGES[locale], key)) delete next[locale][key];
      else next[locale][key] = text;
    }
  }
  return next;
}

export type TranslationError = "key" | "text" | "tooLong";
export interface TranslationDraft {
  key: string;
  en: string;
  he: string;
}

/** Add or edit one key. Both languages need a text; it is stored as typed, because spaces can matter (a list separator is ", "). */
export function saveTranslation(overrides: TranslationOverrides, { key, en, he }: TranslationDraft): Result<TranslationOverrides, TranslationError> {
  if (!isTranslationKey(key)) return { ok: false, error: "key" };
  if (!en.trim() || !he.trim()) return { ok: false, error: "text" };
  if (en.length > TEXT_MAX || he.length > TEXT_MAX) return { ok: false, error: "tooLong" };
  return { ok: true, value: withTexts(overrides, [[key, { en, he }]]) };
}

/** Back to the built-in text. For a key an admin added, this deletes the key. */
export function resetTranslation(overrides: TranslationOverrides, key: string): TranslationOverrides {
  const without = (map: Record<string, string>) => Object.fromEntries(Object.entries(map).filter(([other]) => other !== key));
  return { en: without(overrides.en), he: without(overrides.he) };
}

/** The export file, which is also the import format: `{ translations: { key: { en, he } } }`. */
export function translationFile(rows: readonly TranslationRow[]): { translations: Record<string, Record<Locale, string>> } {
  return { translations: Object.fromEntries(rows.map((row) => [row.key, { en: row.en, he: row.he }])) };
}

export interface TranslationPlanItem {
  section: "translations";
  name: string;
  status: ItemStatus;
  issues: PlanIssue[];
}
export interface TranslationPlan {
  items: TranslationPlanItem[];
  counts: Record<ItemStatus, number>;
  /** The overrides after the import. Null when anything is invalid: an import applies fully or not at all. */
  next: TranslationOverrides | null;
}

const valueSchema = z.strictObject({ en: z.string().max(TEXT_MAX).optional(), he: z.string().max(TEXT_MAX).optional() });
const isMap = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

interface TranslationPlanInput {
  /** Parsed JSON, still untrusted. */
  value: unknown;
  overrides: TranslationOverrides;
  locale: Locale;
}

/** Merge by key: a language the file gives overwrites, a language it leaves out stays, nothing is ever removed. */
export function planTranslationImport({ value, overrides, locale }: TranslationPlanInput): Result<TranslationPlan, FileError> {
  const root = isMap(value) && isMap(value.translations) ? value.translations : value;
  if (!isMap(root)) return { ok: false, error: "wrongShape" };
  const entries = Object.entries(root);
  if (entries.length > MAX_TRANSLATION_ITEMS) return { ok: false, error: "tooManyItems" };

  const current = new Map(translationRows(overrides).map((row) => [row.key, row]));
  const changes: [string, Texts][] = [];
  const counts: Record<ItemStatus, number> = { create: 0, update: 0, unchanged: 0, invalid: 0 };
  const items = entries.map(([key, raw]): TranslationPlanItem => {
    const item = (status: ItemStatus, issues: PlanIssue[] = []): TranslationPlanItem => {
      counts[status] += 1;
      return { section: "translations", name: key.slice(0, NAME_MAX), status, issues };
    };
    if (!isTranslationKey(key)) return item("invalid", [{ code: "translationKey", path: "", detail: key.slice(0, NAME_MAX) }]);
    const parsed = fromZod(valueSchema.safeParse(raw, { error: ZOD_MESSAGES[locale] }));
    if (parsed.value === null) return item("invalid", parsed.issues);
    // A blank text counts as "not given", so a half-filled file never wipes a language.
    const given = (text?: string) => (text?.trim() ? text : undefined);
    const texts: Texts = { en: given(parsed.value.en), he: given(parsed.value.he) };
    if (!texts.en && !texts.he) return item("invalid", [{ code: "noText", path: "", detail: key }]);
    const row = current.get(key);
    const differs = !row || LOCALES.some((language) => texts[language] !== undefined && texts[language] !== row[language]);
    if (differs) changes.push([key, texts]);
    return item(!row ? "create" : differs ? "update" : "unchanged");
  });
  return { ok: true, value: { items, counts, next: counts.invalid === 0 ? withTexts(overrides, changes) : null } };
}
