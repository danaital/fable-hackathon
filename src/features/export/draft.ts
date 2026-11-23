import { logger } from "@/lib/logger";
import { wizardStateSchema, type WizardState } from "./schema";

// A refresh while the wizard is open should not lose the work: the draft lives for the browser tab only.
const KEY_PREFIX = "bahir_export_draft_";
const keyFor = (reportId: string) => `${KEY_PREFIX}${reportId}`;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Stored draft → wizard state. Each member that is missing or invalid falls back to its default. */
export function restoreDraft(raw: unknown, defaults: WizardState): WizardState {
  if (!isRecord(raw)) return defaults;
  const members = wizardStateSchema.keyof().options.map(
    (key) => [key, wizardStateSchema.shape[key].safeParse(raw[key]).success ? raw[key] : defaults[key]] as const,
  );
  const result = wizardStateSchema.safeParse(Object.fromEntries(members));
  return result.success ? result.data : defaults;
}

function storage<T>(action: (store: Storage) => T): T | null {
  try {
    return action(window.sessionStorage);
  } catch {
    logger.warn("export draft storage unavailable"); // private mode, full storage or a corrupt draft: carry on without it
    return null;
  }
}

/** The draft left by a refresh, or null when there is none. */
export function loadDraft(reportId: string, defaults: WizardState): WizardState | null {
  return storage((store) => {
    const raw = store.getItem(keyFor(reportId));
    return raw === null ? null : restoreDraft(JSON.parse(raw), defaults);
  });
}

export function saveDraft(reportId: string, state: WizardState): void {
  storage((store) => store.setItem(keyFor(reportId), JSON.stringify(state)));
}

export function clearDraft(reportId: string): void {
  storage((store) => store.removeItem(keyFor(reportId)));
}
