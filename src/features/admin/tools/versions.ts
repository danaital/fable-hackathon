"use client";

import { useMemo } from "react";
import { z } from "zod";
import type { Locale } from "@/lib/prefs";
import { createLocalStore } from "@/lib/store";

// Version releases: one pipeline entry (the version in progress) and the released list.
// shortcut: stored in this browser only (see lib/store.ts). Move to the database with the admin API;
// the screen and the About page only use this module.

export const VERSION_MAX = 50;
export const TITLE_MAX = 200;
export const TEXT_MAX = 5000;
export const MAX_LIST_ITEMS = 100;
export const CHANGE_TYPES = ["feature", "improvement", "fix", "security", "breaking"] as const;
export const CHANGE_AREAS = ["backend", "frontend", "database", "fullStack"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];
export type ChangeArea = (typeof CHANGE_AREAS)[number];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DAY_LENGTH = 10;

/** A real calendar date in ISO form: 2026-02-30 is refused. */
export function isRealIsoDate(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, ISO_DAY_LENGTH) === value;
}

const localized = (max: number) => z.strictObject({ en: z.string().max(max), he: z.string().max(max) });
export type LocalizedNotes = Record<Locale, string>;

const changeSchema = z.strictObject({
  title: z.string().max(TITLE_MAX),
  description: z.string().max(TEXT_MAX),
  changeType: z.enum(CHANGE_TYPES),
  area: z.enum(CHANGE_AREAS),
  wip: z.boolean().optional(),
});
export type VersionChange = z.infer<typeof changeSchema>;

const draftShape = {
  version: z.string().max(VERSION_MAX),
  releaseDate: z.string().refine(isRealIsoDate).nullable(),
  title: localized(TITLE_MAX),
  summary: localized(TEXT_MAX),
  highlights: z.array(z.string().max(TITLE_MAX)).max(MAX_LIST_ITEMS),
  changes: z.array(changeSchema).max(MAX_LIST_ITEMS),
};
const draftSchema = z.strictObject(draftShape);
const releasedSchema = z.strictObject({ id: z.number().int().positive(), ...draftShape });
const stateSchema = z.strictObject({ pipeline: draftSchema.nullable(), released: z.array(releasedSchema) });

/** The editable part of a version; the pipeline is exactly this. */
export type VersionDraft = z.infer<typeof draftSchema>;
export type ReleasedVersion = z.infer<typeof releasedSchema>;
export type VersionsState = z.infer<typeof stateSchema>;

export const EMPTY_DRAFT: VersionDraft = {
  version: "",
  releaseDate: null,
  title: { en: "", he: "" },
  summary: { en: "", he: "" },
  highlights: [],
  changes: [],
};
export const NEW_CHANGE: VersionChange = { title: "", description: "", changeType: "feature", area: "fullStack", wip: false };

// The build that is running (package.json version), so the released list and the About page are never empty.
const INITIAL_STATE: VersionsState = {
  pipeline: null,
  released: [
    {
      ...EMPTY_DRAFT,
      id: 1,
      version: "0.1.0",
      title: { en: "First Bahir build", he: "הגרסה הראשונה של בהיר" },
      summary: {
        en: "Reports with filters, saved views, widgets, charts and export, in English and Hebrew.",
        he: "דוחות עם סינון, תצוגות שמורות, כרטיסי סיכום, תרשימים וייצוא, בעברית ובאנגלית.",
      },
    },
  ],
};

export const versionsStore = createLocalStore<VersionsState>("bahir_versions", stateSchema, INITIAL_STATE);

export type VersionError = "versionRequired" | "titleRequired" | "duplicate" | "date" | "noPipelineVersion";
export type VersionResult = { ok: true; state: VersionsState } | { ok: false; error: VersionError };
export type VersionMode = "release" | "pipeline";

/** Newest first: a new release sorts to the top whatever its date. */
export const sortReleased = (released: readonly ReleasedVersion[]): ReleasedVersion[] => [...released].sort((a, b) => b.id - a.id);

/** Trims every text; blank highlights and changes without a title are dropped. */
export function cleanDraft(draft: VersionDraft): VersionDraft {
  return {
    version: draft.version.trim(),
    releaseDate: draft.releaseDate?.trim() || null,
    title: { en: draft.title.en.trim(), he: draft.title.he.trim() },
    summary: { en: draft.summary.en.trim(), he: draft.summary.he.trim() },
    highlights: draft.highlights.map((line) => line.trim()).filter(Boolean),
    changes: draft.changes.map((change) => ({ ...change, title: change.title.trim(), description: change.description.trim() })).filter((change) => change.title),
  };
}

interface ValidateInput {
  state: VersionsState;
  draft: VersionDraft;
  mode: VersionMode;
  /** The released entry being edited, so it does not collide with itself. */
  editingId?: number;
}

/** First problem with a cleaned draft, or null. A release needs a version and a title in both languages. */
export function validateDraft({ state, draft, mode, editingId }: ValidateInput): VersionError | null {
  if (draft.releaseDate !== null && !isRealIsoDate(draft.releaseDate)) return "date";
  if (mode === "release" && !draft.version) return "versionRequired";
  if (mode === "release" && !(draft.title.en && draft.title.he)) return "titleRequired";
  const taken = state.released.some((entry) => entry.id !== editingId && entry.version === draft.version);
  const pipelineClash = mode === "release" && state.pipeline?.version === draft.version;
  return draft.version && (taken || pipelineClash) ? "duplicate" : null;
}

/** Creates a released entry, or replaces the one with `editingId`. */
export function saveRelease(input: Omit<ValidateInput, "mode">): VersionResult {
  const draft = cleanDraft(input.draft);
  const error = validateDraft({ ...input, draft, mode: "release" });
  if (error) return { ok: false, error };
  const { state, editingId } = input;
  const nextId = Math.max(0, ...state.released.map((entry) => entry.id)) + 1;
  const released =
    editingId === undefined
      ? [...state.released, { ...draft, id: nextId }]
      : state.released.map((entry) => (entry.id === editingId ? { ...draft, id: editingId } : entry));
  return { ok: true, state: { ...state, released } };
}

/** Saving the pipeline with a blank version clears the whole pipeline. */
export function savePipeline(state: VersionsState, raw: VersionDraft): VersionResult {
  const draft = cleanDraft(raw);
  const error = validateDraft({ state, draft, mode: "pipeline" });
  if (error) return { ok: false, error };
  return { ok: true, state: { ...state, pipeline: draft.version ? draft : null } };
}

interface ReleaseInput {
  state: VersionsState;
  /** Empty: today. */
  releaseDate: string;
  /** Empty: no pipeline afterwards. */
  nextVersion: string;
  today: string;
}

/** Copies the pipeline into a new released entry, then resets the pipeline to the next version or to nothing. */
export function releasePipeline({ state, releaseDate, nextVersion, today }: ReleaseInput): VersionResult {
  if (!state.pipeline?.version) return { ok: false, error: "noPipelineVersion" };
  const saved = saveRelease({ state: { ...state, pipeline: null }, draft: { ...state.pipeline, releaseDate: releaseDate.trim() || today } });
  if (!saved.ok) return saved;
  const next = nextVersion.trim();
  if (next && saved.state.released.some((entry) => entry.version === next)) return { ok: false, error: "duplicate" };
  return { ok: true, state: { ...saved.state, pipeline: next ? { ...EMPTY_DRAFT, version: next } : null } };
}

export const deleteRelease = (state: VersionsState, id: number): VersionsState => ({
  ...state,
  released: state.released.filter((entry) => entry.id !== id),
});

export interface VersionsSummary {
  /** The newest released version. */
  current: { version: string; notes: LocalizedNotes } | null;
  /** The pipeline entry the admin versions screen edits. `plannedFor` is an ISO date or null. */
  upcoming: { version: string; notes: LocalizedNotes; plannedFor: string | null } | null;
}

export function summarizeVersions({ pipeline, released }: VersionsState): VersionsSummary {
  const [latest] = sortReleased(released);
  return {
    current: latest ? { version: latest.version, notes: latest.summary } : null,
    upcoming: pipeline ? { version: pipeline.version, notes: pipeline.summary, plannedFor: pipeline.releaseDate } : null,
  };
}

/** For the About page: the running version and the upcoming one, re-rendering when an admin edits them. */
export function useVersions(): VersionsSummary {
  const state = versionsStore.useValue();
  return useMemo(() => summarizeVersions(state), [state]);
}
