import { describe, expect, it } from "vitest";
import { REPORTS } from "@/data/reports";
import {
  EMPTY_REGISTRY,
  MAX_CUSTOM_REPORTS,
  createReport,
  deleteReport,
  registrySchema,
  resolveReports,
  saveField,
  saveReport,
  settingsOf,
  type Registry,
  type ReportForm,
} from "./registry";

interface Texts {
  locale: "en" | "he";
  t: (key: string) => string;
}
const en: Texts = { locale: "en", t: (key) => `<${key}>` };
const he: Texts = { ...en, locale: "he" };
const form: ReportForm = { title: { en: "Late orders", he: "הזמנות באיחור" }, description: { en: "", he: "" }, icon: "shipments", tags: ["operations"] };
const created = (registry: Registry = EMPTY_REGISTRY, id = "late_orders"): Registry => {
  const result = createReport(registry, { id, source: "orders", form });
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
const errorOf = (result: { ok: true } | { ok: false; error: string }) => (result.ok ? null : result.error);

describe("resolveReports", () => {
  it("returns the built-in reports unchanged when nothing is stored", () => {
    const reports = resolveReports(EMPTY_REGISTRY, en);
    expect(reports.map((report) => report.id)).toEqual(REPORTS.map((report) => report.id));
    expect(reports[0]).toMatchObject({ id: "orders", source: "orders", custom: false, title: "<report.orders.title>", icon: "orders" });
    expect(reports[0].fields[0]).toEqual({ key: "orderId", type: "string", label: "<field.orderId>", hidden: false });
  });

  it("adds a custom report that reads the fields of its source dataset", () => {
    const report = resolveReports(created(), he).find((item) => item.id === "late_orders");
    expect(report).toMatchObject({ source: "orders", custom: true, title: "הזמנות באיחור", description: "", icon: "shipments", tags: ["operations"] });
    expect(report?.fields).toHaveLength(REPORTS[0].fields.length);
  });

  it("lays stored texts over a built-in report, per language, and falls back when a text is empty", () => {
    const saved = saveReport(EMPTY_REGISTRY, { id: "orders", form: { ...form, title: { en: "Sales orders", he: "" } } });
    if (!saved.ok) throw new Error(saved.error);
    const find = (source: Texts) => resolveReports(saved.value, source).find((report) => report.id === "orders");
    expect(find(en)?.title).toBe("Sales orders");
    expect(find(he)?.title).toBe("<report.orders.title>");
  });

  it("ignores stored entries that name an unknown dataset or reuse a taken id", () => {
    const stored: Registry = { settings: {}, custom: [{ id: "orders", source: "customers" }, { id: "ghost", source: "nowhere" }, { id: "ok", source: "tickets" }, { id: "ok", source: "orders" }] };
    const reports = resolveReports(stored, en);
    expect(reports).toHaveLength(REPORTS.length + 1);
    expect(reports.at(-1)).toMatchObject({ id: "ok", source: "tickets" });
  });
});

describe("createReport", () => {
  it("accepts only identifier-like ids", () => {
    for (const id of ["", "1abc", "late-orders", "late orders", "<b>x</b>", "a".repeat(65)]) {
      expect(errorOf(createReport(EMPTY_REGISTRY, { id, source: "orders", form }))).toBe("idInvalid");
    }
  });

  it("refuses an id that is already a report, whatever the case", () => {
    expect(errorOf(createReport(EMPTY_REGISTRY, { id: "Orders", source: "orders", form }))).toBe("idTaken");
    expect(errorOf(createReport(created(), { id: "LATE_ORDERS", source: "orders", form }))).toBe("idTaken");
  });

  it("refuses an unknown source dataset", () => {
    expect(errorOf(createReport(EMPTY_REGISTRY, { id: "x", source: "users", form }))).toBe("sourceUnknown");
  });

  it("needs a title in both languages and at least one tag", () => {
    expect(errorOf(createReport(EMPTY_REGISTRY, { id: "x", source: "orders", form: { ...form, title: { en: "X", he: "  " } } }))).toBe("titleRequired");
    expect(errorOf(createReport(EMPTY_REGISTRY, { id: "x", source: "orders", form: { ...form, tags: [] } }))).toBe("tagsRequired");
  });

  it("stops at the custom report limit", () => {
    let registry = EMPTY_REGISTRY;
    for (let index = 0; index < MAX_CUSTOM_REPORTS; index += 1) registry = created(registry, `r${index}`);
    expect(errorOf(createReport(registry, { id: "one_more", source: "orders", form }))).toBe("tooMany");
  });

  it("stores trimmed texts that pass the stored schema", () => {
    const registry = created();
    expect(registrySchema.safeParse(registry).success).toBe(true);
    const padded = saveReport(registry, { id: "late_orders", form: { ...form, title: { en: "  Late  ", he: " מאחרות " } } });
    expect(padded.ok && padded.value.settings.late_orders.title).toEqual({ en: "Late", he: "מאחרות" });
  });
});

describe("saveReport, saveField, deleteReport", () => {
  it("lets a built-in report drop its title override but not a custom one", () => {
    const empty = { ...form, title: { en: "", he: "" } };
    expect(saveReport(EMPTY_REGISTRY, { id: "orders", form: empty }).ok).toBe(true);
    expect(errorOf(saveReport(created(), { id: "late_orders", form: empty }))).toBe("titleRequired");
    expect(errorOf(saveReport(EMPTY_REGISTRY, { id: "missing", form }))).toBe("notFound");
  });

  it("keeps field changes when the report settings are saved again", () => {
    const withField = saveField(created(), { id: "late_orders", key: "agent", label: { en: "Rep", he: "" }, hidden: true });
    if (!withField.ok) throw new Error(withField.error);
    const again = saveReport(withField.value, { id: "late_orders", form });
    expect(again.ok && again.value.settings.late_orders.fields).toEqual({ agent: { label: { en: "Rep", he: "" }, hidden: true } });
    expect(resolveReports(withField.value, en).find((report) => report.id === "late_orders")?.fields.find((field) => field.key === "agent")).toMatchObject({ label: "Rep", hidden: true });
  });

  it("refuses a field the dataset does not have, and hiding the last visible field", () => {
    expect(errorOf(saveField(EMPTY_REGISTRY, { id: "orders", key: "password", label: { en: "", he: "" }, hidden: true }))).toBe("fieldUnknown");
    let registry = EMPTY_REGISTRY;
    const keys = REPORTS[1].fields.map((field) => field.key);
    for (const key of keys.slice(1)) {
      const result = saveField(registry, { id: "customers", key, label: { en: "", he: "" }, hidden: true });
      if (!result.ok) throw new Error(result.error);
      registry = result.value;
    }
    expect(errorOf(saveField(registry, { id: "customers", key: keys[0], label: { en: "", he: "" }, hidden: true }))).toBe("lastVisible");
  });

  it("deletes a custom report with its settings, and never a built-in one", () => {
    expect(deleteReport(created(), "late_orders")).toEqual({ ok: true, value: EMPTY_REGISTRY });
    expect(errorOf(deleteReport(created(), "orders"))).toBe("notCustom");
  });

  it("gives the built-in icon and tags when nothing is stored", () => {
    expect(settingsOf(EMPTY_REGISTRY, "orders")).toMatchObject({ icon: "orders", tags: ["sales", "operations", "finance"], fields: {} });
    expect(settingsOf(EMPTY_REGISTRY, "missing")).toBeNull();
  });
});

describe("stored registry", () => {
  it("rejects unknown properties, bad ids and markup-like field keys", () => {
    expect(registrySchema.safeParse({ ...EMPTY_REGISTRY, extra: 1 }).success).toBe(false);
    expect(registrySchema.safeParse({ settings: {}, custom: [{ id: "a b", source: "orders" }] }).success).toBe(false);
    const settings = { orders: { ...form, fields: { "<img>": { label: { en: "", he: "" }, hidden: false } } } };
    expect(registrySchema.safeParse({ custom: [], settings }).success).toBe(false);
  });
});
