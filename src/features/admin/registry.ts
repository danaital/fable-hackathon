"use client";

import { useMemo } from "react";
import { z } from "zod";
import { REPORTS } from "@/data/reports";
import { REPORT_ICONS, TAGS, type FieldType, type ReportDef, type ReportIcon, type Tag } from "@/data/types";
import { useI18n, type I18nKey } from "@/i18n";
import type { Locale } from "@/lib/prefs";
import { createLocalStore } from "@/lib/store";
import { identifierSchema, type Result } from "./tools/model";

// Report definitions an admin changed or added. Built-in reports stay in src/data/reports.ts; this lays stored
// settings over them and adds custom reports, each reading the rows and fields of one built-in dataset.
// shortcut: kept in this browser (lib/store.ts); move to report tables behind /api/admin/reports with the database.

export const REPORT_ID_MAX = 64;
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 500;
export const MAX_CUSTOM_REPORTS = 50;
const STORAGE_KEY = "bahir_report_registry";

/** Admin-written text in both languages. An empty text means "use the built-in text". */
export interface Localized {
  en: string;
  he: string;
}
const NO_TEXT: Localized = { en: "", he: "" };

const reportIdSchema = identifierSchema.max(REPORT_ID_MAX);
const textSchema = (max: number) => z.strictObject({ en: z.string().max(max), he: z.string().max(max) });
const fieldSettingsSchema = z.strictObject({ label: textSchema(TITLE_MAX), hidden: z.boolean() });
const settingsSchema = z.strictObject({
  title: textSchema(TITLE_MAX),
  description: textSchema(DESCRIPTION_MAX),
  icon: z.enum(REPORT_ICONS),
  tags: z.array(z.enum(TAGS)).min(1),
  /** Per field key of the source dataset. */
  fields: z.record(identifierSchema, fieldSettingsSchema),
});
const customReportSchema = z.strictObject({ id: reportIdSchema, source: identifierSchema });

export const registrySchema = z.strictObject({
  custom: z.array(customReportSchema).max(MAX_CUSTOM_REPORTS),
  /** Per report id, built-in or custom. */
  settings: z.record(reportIdSchema, settingsSchema),
});
export type Registry = z.infer<typeof registrySchema>;
export type ReportSettings = z.infer<typeof settingsSchema>;
export type ReportForm = Omit<ReportSettings, "fields">;

export const EMPTY_REGISTRY: Registry = { custom: [], settings: {} };
export const registryStore = createLocalStore<Registry>(STORAGE_KEY, registrySchema, EMPTY_REGISTRY);

export interface ReportFieldView {
  key: string;
  type: FieldType;
  label: string;
  hidden: boolean;
}

/** One report as the screens show it, in the current language. */
export interface ReportView {
  id: string;
  /** The built-in dataset the rows and fields come from. Equals `id` for a built-in report. */
  source: string;
  custom: boolean;
  title: string;
  description: string;
  icon: ReportIcon;
  tags: readonly Tag[];
  fields: ReportFieldView[];
}

const sourceOf = (id: string): ReportDef | undefined => REPORTS.find((report) => report.id === id);

/** Built-in reports first, then custom ones. Stored entries with an unknown dataset or a taken id are ignored. */
function definitions(registry: Registry): { id: string; def: ReportDef; custom: boolean }[] {
  const taken = new Set(REPORTS.map((report) => report.id));
  const custom = registry.custom.flatMap(({ id, source }) => {
    const def = sourceOf(source);
    if (!def || taken.has(id)) return [];
    taken.add(id);
    return [{ id, def, custom: true }];
  });
  return [...REPORTS.map((def) => ({ id: def.id, def, custom: false })), ...custom];
}

interface TextSource {
  locale: Locale;
  t: (key: I18nKey) => string;
}

export function resolveReports(registry: Registry, { locale, t }: TextSource): ReportView[] {
  return definitions(registry).map(({ id, def, custom }) => {
    // Own properties only: an id such as "constructor" must not read something inherited.
    const settings = Object.hasOwn(registry.settings, id) ? registry.settings[id] : undefined;
    const fieldSettings = (key: string) => (settings && Object.hasOwn(settings.fields, key) ? settings.fields[key] : undefined);
    return {
      id,
      source: def.id,
      custom,
      title: settings?.title[locale] || (custom ? id : t(def.titleKey)),
      description: settings?.description[locale] || (custom ? "" : t(def.descKey)),
      icon: settings?.icon ?? def.icon,
      tags: settings?.tags ?? def.tags,
      fields: def.fields.map((field) => ({
        key: field.key,
        type: field.type,
        label: fieldSettings(field.key)?.label[locale] || t(field.labelKey),
        hidden: fieldSettings(field.key)?.hidden ?? false,
      })),
    };
  });
}

/** Built-in reports merged with the stored changes, in the current language. Follows edits from other tabs. */
export function useReportDefs(): ReportView[] {
  const registry = registryStore.useValue();
  const { locale, t } = useI18n();
  return useMemo(() => resolveReports(registry, { locale, t }), [registry, locale, t]);
}

/** The stored settings of a report, or its built-in icon and tags with no text changes. Null for an unknown report. */
export function settingsOf(registry: Registry, id: string): ReportSettings | null {
  const found = definitions(registry).find((item) => item.id === id);
  if (!found) return null;
  if (Object.hasOwn(registry.settings, id)) return registry.settings[id];
  return { title: NO_TEXT, description: NO_TEXT, icon: found.def.icon, tags: [...found.def.tags], fields: {} };
}

export const REGISTRY_ERRORS = ["idInvalid", "idTaken", "sourceUnknown", "titleRequired", "tagsRequired", "tooMany", "notFound", "notCustom", "fieldUnknown", "lastVisible", "invalid"] as const;
export type RegistryError = (typeof REGISTRY_ERRORS)[number];
type Saved = Result<Registry, RegistryError>;

const fail = (error: RegistryError): Saved => ({ ok: false, error });
const trimmed = ({ en, he }: Localized): Localized => ({ en: en.trim(), he: he.trim() });

/** The last gate before storage: whatever the forms did, only a registry that passes the stored schema is written. */
function checked(registry: Registry): Saved {
  const parsed = registrySchema.safeParse(registry);
  return parsed.success ? { ok: true, value: parsed.data } : fail("invalid");
}

interface FormCheck {
  form: ReportForm;
  custom: boolean;
}

function formError({ form, custom }: FormCheck): RegistryError | null {
  const title = trimmed(form.title);
  // A custom report has no built-in title to fall back to.
  if (custom && (!title.en || !title.he)) return "titleRequired";
  if (form.tags.length === 0) return "tagsRequired";
  return null;
}

function withSettings(registry: Registry, id: string, settings: ReportSettings): Registry {
  const next = { ...settings, title: trimmed(settings.title), description: trimmed(settings.description) };
  return { ...registry, settings: { ...registry.settings, [id]: next } };
}

export function createReport(registry: Registry, { id, source, form }: { id: string; source: string; form: ReportForm }): Saved {
  if (!reportIdSchema.safeParse(id).success) return fail("idInvalid");
  if (definitions(registry).some((item) => item.id.toLowerCase() === id.toLowerCase())) return fail("idTaken");
  if (!sourceOf(source)) return fail("sourceUnknown");
  const error = formError({ form, custom: true });
  if (error) return fail(error);
  if (registry.custom.length >= MAX_CUSTOM_REPORTS) return fail("tooMany");
  return checked(withSettings({ ...registry, custom: [...registry.custom, { id, source }] }, id, { ...form, fields: {} }));
}

/** Title, description, icon and tags of an existing report. Its field changes are kept. */
export function saveReport(registry: Registry, { id, form }: { id: string; form: ReportForm }): Saved {
  const current = settingsOf(registry, id);
  if (!current) return fail("notFound");
  const error = formError({ form, custom: registry.custom.some((item) => item.id === id) });
  if (error) return fail(error);
  return checked(withSettings(registry, id, { ...form, fields: current.fields }));
}

interface FieldChange {
  id: string;
  key: string;
  label: Localized;
  hidden: boolean;
}

/** Label and visibility of one field. The key must be a field of the report's dataset; one field always stays visible. */
export function saveField(registry: Registry, { id, key, label, hidden }: FieldChange): Saved {
  const current = settingsOf(registry, id);
  const found = definitions(registry).find((item) => item.id === id);
  if (!current || !found) return fail("notFound");
  if (!found.def.fields.some((field) => field.key === key)) return fail("fieldUnknown");
  const fields = { ...current.fields, [key]: { label: trimmed(label), hidden } };
  if (found.def.fields.every((field) => Object.hasOwn(fields, field.key) && fields[field.key].hidden)) return fail("lastVisible");
  return checked(withSettings(registry, id, { ...current, fields }));
}

/** Only a custom report can be deleted. Its settings go with it; the caller removes its access rows. */
export function deleteReport(registry: Registry, id: string): Saved {
  if (!registry.custom.some((item) => item.id === id)) return fail("notCustom");
  const settings = Object.fromEntries(Object.entries(registry.settings).filter(([key]) => key !== id));
  return checked({ custom: registry.custom.filter((item) => item.id !== id), settings });
}
