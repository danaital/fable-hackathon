import type { I18nKey } from "@/i18n/en";
import { DESIGN_SECTIONS, FONT_SIZE_MAX, FONT_SIZE_MIN, STEP_IDS, type StepId, type WizardState } from "./schema";

/** Facts about the page that decide which steps apply. */
export interface StepEnv {
  hasCharts: boolean;
}

type Rule<T> = (state: WizardState, env: StepEnv) => T;

// A plain text file has no summary row, groups, charts or styling, so those steps would be dead controls.
const isCsv: Rule<boolean> = (state) => state.format === "csv";

// HOOK(currency): give "currency" a skip rule here (skip when no currency field is exported).
const SKIP: Partial<Record<StepId, Rule<boolean>>> = {
  // A saved view or the page brings its own columns; only "template" (read-only) and "custom" show the step.
  fields: (state) => state.source !== "template" && state.source !== "custom",
  summary: isCsv,
  grouping: isCsv,
  charts: (state, env) => isCsv(state, env) || !env.hasCharts,
  fileTemplate: isCsv,
};

/** Why the step cannot be left yet, as a message key; null when it is valid. */
const VALIDATE: Partial<Record<StepId, Rule<I18nKey | null>>> = {
  source: (state) => {
    if (state.source === "other_view" && !state.otherViewId) return "export.invalid.view";
    if (state.source === "template" && !state.templateId) return "export.invalid.template";
    return null;
  },
  fields: (state) => (state.source === "custom" && state.selectedFields.length === 0 ? "export.invalid.fields" : null),
  grouping: (state) => (state.grouping.enabled && state.grouping.groupBy.length === 0 ? "export.invalid.grouping" : null),
  fileTemplate: (state) => {
    const sizes = DESIGN_SECTIONS.map((name) => state.design[name].fontSize);
    return sizes.every((size) => Number.isInteger(size) && size >= FONT_SIZE_MIN && size <= FONT_SIZE_MAX) ? null : "export.invalid.fontSize";
  },
};

/** The steps that apply, in order. Steps that do not apply are simply not there; nothing is "skipped" by hand. */
export function visibleSteps(state: WizardState, env: StepEnv): StepId[] {
  return STEP_IDS.filter((step) => !SKIP[step]?.(state, env));
}

export function validateStep(step: StepId, state: WizardState, env: StepEnv): I18nKey | null {
  return VALIDATE[step]?.(state, env) ?? null;
}

/** When an earlier choice removes the current step, fall back to the nearest step before it that still applies. */
export function clampStep(step: StepId, visible: readonly StepId[]): StepId {
  if (visible.includes(step)) return step;
  const earlier = STEP_IDS.slice(0, STEP_IDS.indexOf(step)).reverse();
  return earlier.find((candidate) => visible.includes(candidate)) ?? visible[0];
}

interface MoveInput {
  step: StepId;
  visible: readonly StepId[];
  /** Whether the current step passes validation. */
  valid: boolean;
}

/** Next applies only from a valid step; on the last step there is no next. */
export function nextStep({ step, visible, valid }: MoveInput): StepId | null {
  const index = visible.indexOf(step);
  return valid && index >= 0 && index < visible.length - 1 ? visible[index + 1] : null;
}

export function previousStep({ step, visible }: Pick<MoveInput, "step" | "visible">): StepId | null {
  const index = visible.indexOf(step);
  return index > 0 ? visible[index - 1] : null;
}

/** The stepper only goes back: to a completed step, and only while the current step is valid. Never forward. */
export function canJumpTo(target: StepId, { step, visible, valid }: MoveInput): boolean {
  const from = visible.indexOf(step);
  const to = visible.indexOf(target);
  return valid && to >= 0 && to < from;
}
