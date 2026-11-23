"use client";

import { translationOverridesStore } from "@/i18n";
import type { Locale } from "@/lib/prefs";
import { parseJsonText, planImport, stableStringify, type FileError, type ItemStatus, type PlanIssue, type PlanProblem, type SectionName } from "./configImport";
import { applyReportConfig, importContext, loadReportConfig, undoReportImport, type UndoResult } from "./configStore";
import type { ImportTarget } from "./lastImport";
import type { Result } from "./model";
import { planTranslationImport } from "./translations";

// From the text of a picked file to a preview that can be applied and undone, for every kind of import.

export interface PreviewItem {
  section: SectionName | "translations";
  name: string;
  status: ItemStatus;
  issues: PlanIssue[];
}
export type Undo = () => UndoResult;
export interface ImportPreviewData {
  items: PreviewItem[];
  counts: Record<ItemStatus, number>;
  problems: PlanProblem[];
  /** Stores the import and returns its undo, or null when the browser refused the write. Null when the file may not be applied. */
  apply: (() => Undo | null) | null;
}

const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

interface PreviewInput {
  /** The file's text, untrusted. It is parsed as JSON and checked; it is never run. */
  text: string;
  target: ImportTarget;
  reportId: string;
  locale: Locale;
}

/** Compares the file with what is stored now. Call it again after any store change: the result is only valid for that moment. */
export function previewImport({ text, target, reportId, locale }: PreviewInput): Result<ImportPreviewData, FileError> {
  const parsed = parseJsonText(text);
  if (!parsed.ok) return parsed;

  if (target === "translations") {
    const before = translationOverridesStore.read();
    const plan = planTranslationImport({ value: parsed.value, overrides: before, locale });
    if (!plan.ok) return plan;
    const { items, counts, next } = plan.value;
    const apply = next
      ? (): Undo | null => {
          translationOverridesStore.write(next);
          if (!same(translationOverridesStore.read(), next)) return null;
          // Refused when a text changed since, so a later edit is never lost.
          return () => {
            if (!same(translationOverridesStore.read(), next)) return "changed";
            translationOverridesStore.write(before);
            return same(translationOverridesStore.read(), before) ? "undone" : "failed";
          };
        }
      : null;
    return { ok: true, value: { items, counts, problems: [], apply } };
  }

  const plan = planImport({ kind: target, value: parsed.value, baseline: loadReportConfig(reportId), context: importContext(locale) });
  if (!plan.ok) return plan;
  const { items, counts, problems, next } = plan.value;
  const apply = next
    ? (): Undo | null => {
        const undo = applyReportConfig(reportId, next);
        return undo ? () => undoReportImport(undo) : null;
      }
    : null;
  return { ok: true, value: { items, counts, problems, apply } };
}
