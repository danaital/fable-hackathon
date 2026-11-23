import { describe, expect, it } from "vitest";
import { createTranslator } from "@/i18n";
import type { I18nKey } from "@/i18n";
import { planImport, parseJsonText, type ImportKind, type ReportConfig } from "./configImport";
import { aliasSchema, dataModelSchema, identifierSchema, isIdentifier } from "./model";
import { SEED_DATA_MODEL } from "./repository";

// A quote, a space, a semicolon, a dot and a leading digit: none may reach a generated query as an identifier.
const BAD = ['a"b', "a b", "a;b", "a.b", "1ab"];
const EMPTY: ReportConfig = { reportEntities: [], entityRelationships: [], fields: [], widgets: [], charts: [], views: [] };
const context = { locale: "en" as const, entities: new Map([["orders", new Set(["orderId", "customer"])], ["customers", new Set(["name"])]]) };

const field = { key: "orders_orderId", entityKey: "orders", columnName: "orderId" };
const link = { sourceEntityKey: "orders", targetEntityKey: "customers", joinType: "LEFT", sourceColumn: "customer", targetColumn: "name", alias: "customer", description: null };
const reportEntity = { entityKey: "orders", alias: "main", isBaseEntity: true, order: 0 };
const CASES: [ImportKind, string, Record<string, unknown>, string[]][] = [
  ["fields", "fields", field, ["key", "entityKey", "columnName"]],
  ["bundle", "entityRelationships", link, ["sourceEntityKey", "targetEntityKey", "sourceColumn", "targetColumn", "alias"]],
  ["bundle", "reportEntities", reportEntity, ["entityKey", "alias"]],
];

describe("identifier validation", () => {
  it("accepts plain identifiers and rejects every unsafe form (form schema)", () => {
    expect(identifierSchema.safeParse("order_id2").success).toBe(true);
    expect(isIdentifier("_x")).toBe(true);
    for (const bad of BAD) {
      expect(identifierSchema.safeParse(bad).success).toBe(false);
      expect(aliasSchema.safeParse(bad).success).toBe(false);
      expect(isIdentifier(bad)).toBe(false);
    }
  });

  it("the stored data model refuses unsafe keys, tables, columns and aliases", () => {
    expect(dataModelSchema.safeParse(SEED_DATA_MODEL).success).toBe(true);
    const [entity] = SEED_DATA_MODEL.entities;
    const [relationship] = SEED_DATA_MODEL.relationships;
    for (const bad of BAD) {
      const variants = [
        { ...SEED_DATA_MODEL, entities: [{ ...entity, key: bad }] },
        { ...SEED_DATA_MODEL, entities: [{ ...entity, tableName: bad }] },
        { ...SEED_DATA_MODEL, entities: [{ ...entity, columns: [{ name: bad, dataType: "string" }] }] },
        { ...SEED_DATA_MODEL, relationships: [{ ...relationship, sourceColumn: bad }] },
        { ...SEED_DATA_MODEL, relationships: [{ ...relationship, targetColumn: bad }] },
        { ...SEED_DATA_MODEL, relationships: [{ ...relationship, alias: bad }] },
      ];
      for (const variant of variants) expect(dataModelSchema.safeParse(variant).success).toBe(false);
    }
  });

  it("JSON import rejects every unsafe identifier and stores nothing", () => {
    for (const [kind, section, item, keys] of CASES) {
      const good = planImport({ kind, value: kind === "bundle" ? { [section]: [item] } : [item], baseline: EMPTY, context });
      expect(good.ok && good.value.next !== null).toBe(true);
      for (const key of keys) {
        for (const bad of BAD) {
          const parsed = parseJsonText(JSON.stringify(kind === "bundle" ? { [section]: [{ ...item, [key]: bad }] } : [{ ...item, [key]: bad }]));
          if (!parsed.ok) throw new Error("test JSON must parse");
          const plan = planImport({ kind, value: parsed.value, baseline: EMPTY, context });
          if (!plan.ok) throw new Error("shape must be accepted");
          expect(plan.value.next).toBeNull();
          expect(plan.value.items[0].issues.some((issue) => issue.code === "identifier" && issue.path === key)).toBe(true);
        }
      }
    }
  });
});

describe("JSON import", () => {
  it("refuses bad JSON, wrong shapes and unknown properties", () => {
    expect(parseJsonText("{nope")).toEqual({ ok: false, error: "invalidJson" });
    expect(parseJsonText("  ")).toEqual({ ok: false, error: "empty" });
    expect(planImport({ kind: "widgets", value: { charts: [] }, baseline: EMPTY, context })).toEqual({ ok: false, error: "wrongShape" });
    const plan = planImport({ kind: "fields", value: [{ ...field, surprise: 1 }], baseline: EMPTY, context });
    expect(plan.ok && plan.value.next).toBeNull();
  });

  it("upserts by key, never deletes, and importing an export twice changes nothing", () => {
    const baseline = { ...EMPTY, fields: [field, { ...field, key: "kept", columnName: "customer" }] };
    const plan = planImport({ kind: "fields", value: { fields: [{ ...field, isAnchor: true }, { ...field, key: "added" }] }, baseline, context });
    if (!plan.ok || !plan.value.next) throw new Error("expected a valid plan");
    expect(plan.value.counts).toEqual({ create: 1, update: 1, unchanged: 0, invalid: 0 });
    expect(plan.value.next.fields.map((item) => item.key)).toEqual(["orders_orderId", "kept", "added"]);
    const again = planImport({ kind: "fields", value: plan.value.next.fields, baseline: plan.value.next, context });
    expect(again.ok && again.value.counts).toEqual({ create: 0, update: 0, unchanged: 3, invalid: 0 });
  });

  it("rejects a widget that names a field the report lacks", () => {
    const widget = { id: "w", type: "custom", field: "missing", title: { en: "A", he: "א" } };
    const plan = planImport({ kind: "widgets", value: [widget], baseline: EMPTY, context });
    expect(plan.ok && plan.value.items[0].issues[0]).toMatchObject({ code: "unknownField", detail: "missing" });
  });
});

describe("translation overrides", () => {
  it("reads an override first, ignores an empty one, and returns the key when no text exists", () => {
    const key = "action.save" as I18nKey;
    expect(createTranslator("en", { en: { [key]: "Store" }, he: {} }).t(key)).toBe("Store");
    expect(createTranslator("en", { en: { [key]: "" }, he: {} }).t(key)).toBe("Save");
    expect(createTranslator("he", { en: { [key]: "Store" }, he: {} }).t(key)).not.toBe("Store");
    expect(createTranslator("en").t("no.such.key" as I18nKey)).toBe("no.such.key");
    expect(createTranslator("en").t("constructor" as I18nKey)).toBe("constructor");
    expect(createTranslator("en", { en: { "status.zz": "Zed" }, he: {} }).tData("status", "zz")).toBe("Zed");
    expect(createTranslator("en").tData("status", "zz")).toBe("zz");
  });
});
