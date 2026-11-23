import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILT_IN_MESSAGES, createTranslator, translationOverridesStore, type TranslationOverrides } from "@/i18n";
import { previewImport } from "./importRun";
import { fakeWindow } from "./testWindow";
import {
  filterRows,
  isTranslationKey,
  isUntranslated,
  planTranslationImport,
  resetTranslation,
  saveTranslation,
  translationFile,
  translationRows,
} from "./translations";

const NONE: TranslationOverrides = { en: {}, he: {} };
const KEY = "action.save";
const BUILT_IN = { en: BUILT_IN_MESSAGES.en[KEY], he: BUILT_IN_MESSAGES.he[KEY] };

function saved(overrides: TranslationOverrides, draft: { key: string; en: string; he: string }): TranslationOverrides {
  const result = saveTranslation(overrides, draft);
  if (!result.ok) throw new Error(`save refused: ${result.error}`);
  return result.value;
}

const importPlan = (value: unknown, overrides = NONE) => {
  const result = planTranslationImport({ value, overrides, locale: "en" });
  if (!result.ok) throw new Error(`file refused: ${result.error}`);
  return result.value;
};

describe("translation rows", () => {
  it("lists every built-in key once, sorted, with the override laid over the built-in text", () => {
    const rows = translationRows(saved(NONE, { key: KEY, en: BUILT_IN.en, he: "לשמור" }));
    expect(rows.map((row) => row.key)).toEqual(Object.keys(BUILT_IN_MESSAGES.en).sort());
    expect(rows.find((row) => row.key === KEY)).toEqual({ key: KEY, en: BUILT_IN.en, he: "לשמור", builtIn: true, changed: true });
    expect(translationRows(NONE).find((row) => row.key === KEY)).toEqual({ key: KEY, ...BUILT_IN, builtIn: true, changed: false });
  });

  it("an added key is a row of its own and is not built in", () => {
    const rows = translationRows(saved(NONE, { key: "custom.greeting", en: "Hello", he: "שלום" }));
    expect(rows.find((row) => row.key === "custom.greeting")).toEqual({ key: "custom.greeting", en: "Hello", he: "שלום", builtIn: false, changed: true });
  });

  it("untranslated means no Hebrew, or Hebrew equal to the English", () => {
    const row = { key: "a", en: "Late", he: "באיחור", builtIn: true, changed: false };
    expect(isUntranslated(row)).toBe(false);
    expect(isUntranslated({ ...row, he: " " })).toBe(true);
    expect(isUntranslated({ ...row, he: "Late " })).toBe(true);
  });

  it("filters by key, ignoring case, and by the untranslated switch", () => {
    const rows = [
      { key: "orders.Status", en: "Status", he: "סטטוס", builtIn: true, changed: false },
      { key: "orders.code", en: "USD", he: "USD", builtIn: true, changed: false },
      { key: "other", en: "Status", he: "", builtIn: false, changed: true },
    ];
    expect(filterRows(rows, { query: "ORDERS.s", untranslatedOnly: false }).map((row) => row.key)).toEqual(["orders.Status"]);
    expect(filterRows(rows, { query: "", untranslatedOnly: true }).map((row) => row.key)).toEqual(["orders.code", "other"]);
    expect(filterRows(rows, { query: "orders", untranslatedOnly: true }).map((row) => row.key)).toEqual(["orders.code"]);
  });
});

describe("editing a translation", () => {
  it("accepts letters, digits, underscore, dot and hyphen in a new key and nothing else", () => {
    for (const good of ["a", "orders.status-late_2"]) expect(isTranslationKey(good)).toBe(true);
    for (const bad of ["", "a b", "a/b", 'a"b', "<b>", "__proto__", "a.constructor.b", "prototype.x", "a".repeat(256)]) {
      expect(isTranslationKey(bad)).toBe(false);
      expect(saveTranslation(NONE, { key: bad, en: "x", he: "y" })).toEqual({ ok: false, error: "key" });
    }
  });

  it("a key shipped with the app stays editable whatever its format, and spaces in its text are kept", () => {
    const odd = "settings.delimiter./";
    expect(Object.hasOwn(BUILT_IN_MESSAGES.en, odd)).toBe(true);
    expect(saved(NONE, { key: odd, en: "Slash ", he: "לוכסן" }).en[odd]).toBe("Slash ");
  });

  it("needs a text in both languages, within the length limit", () => {
    expect(saveTranslation(NONE, { key: KEY, en: " ", he: "y" })).toEqual({ ok: false, error: "text" });
    expect(saveTranslation(NONE, { key: KEY, en: "x", he: "" })).toEqual({ ok: false, error: "text" });
    expect(saveTranslation(NONE, { key: KEY, en: "x".repeat(5001), he: "y" })).toEqual({ ok: false, error: "tooLong" });
  });

  it("writes the override the translator reads, as typed", () => {
    const overrides = saved(NONE, { key: KEY, en: "Store", he: "לאחסן" });
    expect(overrides).toEqual({ en: { [KEY]: "Store" }, he: { [KEY]: "לאחסן" } });
    expect(createTranslator("en", overrides).t(KEY)).toBe("Store");
    expect(createTranslator("he", overrides).t(KEY)).toBe("לאחסן");
  });

  it("a text equal to the built-in one is not stored, so it keeps following the code", () => {
    const changed = saved(NONE, { key: KEY, en: "Store", he: "לאחסן" });
    expect(saved(changed, { key: KEY, ...BUILT_IN })).toEqual(NONE);
  });

  it("reset removes the override in both languages and leaves the other keys", () => {
    const overrides = saved(saved(NONE, { key: KEY, en: "Store", he: "לאחסן" }), { key: "custom.x", en: "X", he: "איקס" });
    const reset = resetTranslation(overrides, KEY);
    expect(reset).toEqual({ en: { "custom.x": "X" }, he: { "custom.x": "איקס" } });
    expect(createTranslator("en", reset).t(KEY)).toBe(BUILT_IN.en);
  });
});

describe("translation files", () => {
  it("exports key → both languages, and importing the export back changes nothing", () => {
    const overrides = saved(NONE, { key: "custom.x", en: "X", he: "איקס" });
    const file = translationFile(translationRows(overrides));
    expect(file.translations["custom.x"]).toEqual({ en: "X", he: "איקס" });
    const plan = importPlan(JSON.parse(JSON.stringify(file)), overrides);
    expect(plan.counts).toEqual({ create: 0, update: 0, unchanged: Object.keys(file.translations).length, invalid: 0 });
    expect(plan.next).toEqual(overrides);
  });

  it("previews create, update and unchanged, and merges one language without touching the other", () => {
    const plan = importPlan({ translations: { "custom.new": { en: "New", he: "חדש" }, [KEY]: { he: "לשמור" }, "action.cancel": { en: BUILT_IN_MESSAGES.en["action.cancel"] } } });
    expect(plan.items.map((item) => [item.name, item.status])).toEqual([
      ["custom.new", "create"],
      [KEY, "update"],
      ["action.cancel", "unchanged"],
    ]);
    expect(plan.next).toEqual({ en: { "custom.new": "New" }, he: { "custom.new": "חדש", [KEY]: "לשמור" } });
  });

  it("accepts the bare map as well as the { translations } wrapper", () => {
    expect(importPlan({ "custom.new": { en: "New" } }).counts.create).toBe(1);
  });

  it("one bad item blocks the whole import and is named", () => {
    const plan = importPlan({ ok: { en: "fine" }, "bad key": { en: "x" }, extra: { en: "x", fr: "y" }, empty: { en: " " }, text: "plain" });
    expect(plan.next).toBeNull();
    expect(plan.counts).toEqual({ create: 1, update: 0, unchanged: 0, invalid: 4 });
    expect(plan.items.filter((item) => item.status === "invalid").map((item) => item.issues[0].code)).toEqual(["translationKey", "schema", "noText", "schema"]);
  });

  it("refuses a file that is not a map of keys", () => {
    for (const value of [[], "text", 1, null]) expect(planTranslationImport({ value, overrides: NONE, locale: "en" })).toEqual({ ok: false, error: "wrongShape" });
  });
});

describe("importing a translation file into the override store", () => {
  afterEach(() => vi.unstubAllGlobals());

  const preview = (file: unknown) => {
    const result = previewImport({ text: JSON.stringify(file), target: "translations", reportId: "orders", locale: "en" });
    if (!result.ok) throw new Error(`file refused: ${result.error}`);
    return result.value;
  };
  const FILE = { translations: { [KEY]: { en: "Store", he: "לאחסן" } } };

  it("apply writes the store the app reads, and undo puts the earlier texts back", () => {
    vi.stubGlobal("window", fakeWindow());
    const undo = preview(FILE).apply?.();
    expect(translationOverridesStore.read()).toEqual({ en: { [KEY]: "Store" }, he: { [KEY]: "לאחסן" } });
    expect(preview(FILE).counts).toEqual({ create: 0, update: 0, unchanged: 1, invalid: 0 });
    expect(undo?.()).toBe("undone");
    expect(translationOverridesStore.read()).toEqual(NONE);
  });

  it("undo is refused after a later edit, which is kept", () => {
    vi.stubGlobal("window", fakeWindow());
    const undo = preview(FILE).apply?.();
    const edited = saved(translationOverridesStore.read(), { key: "custom.x", en: "X", he: "איקס" });
    translationOverridesStore.write(edited);
    expect(undo?.()).toBe("changed");
    expect(translationOverridesStore.read()).toEqual(edited);
  });

  it("an invalid file cannot be applied, and a refused write reports failure", () => {
    expect(preview({ "bad key": { en: "x" } }).apply).toBeNull();
    vi.stubGlobal("window", fakeWindow(["bahir_translations"]));
    expect(preview(FILE).apply?.()).toBeNull();
  });
});
