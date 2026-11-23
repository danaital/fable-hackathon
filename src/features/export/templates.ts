"use client";

import { z } from "zod";
import { createLocalStore } from "@/lib/store";
import { NAME_MAX, NAME_MIN, exportTemplateSchema, fileTemplateSchema, type ExportTemplate, type FileTemplate } from "./schema";

// shortcut: export templates and styling presets live in this browser only (no login or database yet).
// Upgrade: back this module with per-user rows and the routes in docs/openapi.json; the screens only use this module.

interface Stored {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export const NAME_ERRORS = ["tooShort", "tooLong", "duplicate"] as const;
export type NameError = (typeof NAME_ERRORS)[number];

/** Name rule shared by both kinds: 2 to 255 characters, not only spaces, unique without regard to case. */
export function nameError(name: string, taken: readonly string[]): NameError | null {
  const clean = name.trim();
  if (clean.length < NAME_MIN) return "tooShort";
  if (clean.length > NAME_MAX) return "tooLong";
  return taken.some((other) => other.trim().toLowerCase() === clean.toLowerCase()) ? "duplicate" : null;
}

/** Default first, then by name. */
export function sorted<T extends Stored>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
}

export function upsert<T extends Stored>(list: readonly T[], item: T): T[] {
  return list.some((other) => other.id === item.id) ? list.map((other) => (other.id === item.id ? item : other)) : [...list, item];
}

interface DefaultInput<T> {
  list: readonly T[];
  id: string;
  value: boolean;
  /** Items that share one default: a report's templates, or the whole library. */
  sameScope: (a: T, b: T) => boolean;
}

/** At most one default per scope: setting it on one item clears it on the others. */
export function withDefault<T extends Stored>({ list, id, value, sameScope }: DefaultInput<T>): T[] {
  const target = list.find((item) => item.id === id);
  if (!target) return [...list];
  return list.map((item) => {
    if (item.id === id) return { ...item, isDefault: value };
    return value && sameScope(item, target) ? { ...item, isDefault: false } : item;
  });
}

interface RepositoryInput<T> {
  key: string;
  schema: z.ZodType<T>;
  sameScope: (a: T, b: T) => boolean;
}

function createRepository<T extends Stored>({ key, schema, sameScope }: RepositoryInput<T>) {
  // One unreadable item is dropped; the rest of the list still loads.
  const listSchema = z.array(schema.nullable().catch(null)).transform((items) => items.filter((item) => item !== null));
  const empty: T[] = [];
  const store = createLocalStore<T[]>(key, listSchema, empty);
  const now = () => new Date().toISOString();
  /** Writes, then confirms the browser really kept it, so the screen can say when saving failed. */
  const commit = (list: T[], id: string, kept: boolean): boolean => {
    store.write(list);
    return store.read().some((item) => item.id === id) === kept;
  };
  const stamp = (content: Omit<T, keyof Stored> & { name: string }): T => {
    const at = now();
    // The spread of a generic type loses its shape; the schema restores the checked type.
    return schema.parse({ ...content, name: content.name.trim(), id: crypto.randomUUID(), isDefault: false, createdAt: at, updatedAt: at });
  };

  return {
    list: store.read,
    /** React hook: the current list, re-rendering on change. */
    useList: store.useValue,
    create(content: Omit<T, keyof Stored> & { name: string }): T | null {
      const item = stamp(content);
      return commit([...store.read(), item], item.id, true) ? item : null;
    },
    update(id: string, patch: Partial<Omit<T, "id" | "createdAt">>): boolean {
      const current = store.read().find((item) => item.id === id);
      if (!current) return false;
      return commit(upsert(store.read(), schema.parse({ ...current, ...patch, updatedAt: now() })), id, true);
    },
    remove: (id: string): boolean => commit(store.read().filter((item) => item.id !== id), id, false),
    clone(id: string, name: string): T | null {
      const source = store.read().find((item) => item.id === id);
      if (!source) return null;
      const copy = stamp({ ...source, name });
      return commit([...store.read(), copy], copy.id, true) ? copy : null;
    },
    setDefault: (id: string, value: boolean): boolean => commit(withDefault({ list: store.read(), id, value, sameScope }), id, true),
  };
}

/** Saved export configurations: one default per report. */
export const exportTemplates = createRepository<ExportTemplate>({
  key: "bahir_export_templates",
  schema: exportTemplateSchema,
  sameScope: (a, b) => a.reportId === b.reportId,
});

/** Saved styling presets: one shared library with one default. */
export const fileTemplates = createRepository<FileTemplate>({
  key: "bahir_file_templates",
  schema: fileTemplateSchema,
  sameScope: () => true,
});
