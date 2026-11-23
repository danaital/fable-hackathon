"use client";

import { ArrowLeft, ArrowRight, Download, Save } from "lucide-react";
import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { Button, Dialog, Heading, Stack, Text, VisuallyHidden } from "@/components/ui";
import { useI18n } from "@/i18n";
import { clearDraft, loadDraft, saveDraft } from "./draft";
import { buildPlan, type PageContext } from "./plan";
import { ProgressPanel } from "./ProgressPanel";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import { FONT_SIZE_MAX, FONT_SIZE_MIN, type StepId } from "./schema";
import { canJumpTo, clampStep, nextStep, previousStep, validateStep, visibleSteps } from "./steps";
import { STEP_VIEWS } from "./steps/registry";
import { Stepper } from "./Stepper";
import { fileTemplates as fileTemplateLibrary } from "./templates";
import { ICON_SIZE } from "./ui";
import { useEscapeGuard } from "./useEscapeGuard";
import { useExportRunner } from "./useExportRunner";
import { applyTemplate, initialState, wizardReducer } from "./wizardState";

// Tunable: how long "download started" stays up before the wizard closes by itself.
const AUTO_CLOSE_MS = 1500;

interface Props {
  page: PageContext;
  /** Start with this export template applied (from the templates list). */
  templateId?: string | null;
  onClose: () => void;
}

/** The export wizard. Mounted only while open, so every open starts fresh, except after a browser refresh. */
export function ExportWizard({ page, templateId, onClose }: Props) {
  const { t, dir, locale } = useI18n();
  const { report } = page;
  const fileTemplates = fileTemplateLibrary.useList();
  const runner = useExportRunner();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const reasonId = useId();

  // What the wizard opened with; resets inside the steps go back to this.
  const [defaults] = useState(() =>
    initialState({ report, view: page.view, locale, charts: page.charts, fileTemplates: fileTemplateLibrary.list(), totalLabel: t("export.summary.defaultLabel") }),
  );
  const [state, dispatch] = useReducer(wizardReducer, defaults, (base) => {
    // A draft only exists when the page was refreshed while the wizard was open: resume it.
    const draft = loadDraft(report.id, base);
    if (draft) return draft;
    const template = page.templates.find((candidate) => candidate.id === templateId);
    return template ? applyTemplate({ state: base, template, fileTemplates: fileTemplateLibrary.list(), defaults: base }) : base;
  });

  const env = useMemo(() => ({ hasCharts: page.charts.length > 0 }), [page.charts.length]);
  const steps = visibleSteps(state, env);
  const step = clampStep(state.step, steps);
  const invalid = validateStep(step, state, env);
  const move = { step, visible: steps, valid: invalid === null };
  const isLast = step === steps[steps.length - 1];
  const { titleKey, Component } = STEP_VIEWS[step];
  const goTo = (target: StepId | null) => {
    if (target) dispatch({ type: "patch", patch: { step: target } });
  };

  useEffect(() => saveDraft(report.id, state), [report.id, state]);
  // Closing (unmounting) drops the draft; a refresh never gets here, which is what keeps the draft.
  useEffect(() => () => clearDraft(report.id), [report.id]);
  // Screen readers hear "Step 3 of 12: Fields" because the heading that takes focus says exactly that.
  useEffect(() => headingRef.current?.focus(), [step]);

  const { busy, progress } = runner;
  const requestClose = () => {
    if (busy) return; // closing is blocked while an export runs
    const dialog = bodyRef.current?.closest("dialog");
    // If the browser already closed the dialog (Escape pressed twice), there is nothing left to confirm.
    if (dialog && !dialog.open) onClose();
    else setConfirming(true);
  };
  // Escape must ask the same question as the close button instead of closing straight away.
  useEscapeGuard({ anchor: bodyRef, active: true, onEscape: requestClose });

  const finished = progress?.stage === "complete" && (progress.rowCount ?? 0) > 0;
  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [finished, onClose]);

  const download = () => {
    clearDraft(report.id);
    void runner.start(() => buildPlan(state, page));
  };

  const [BackIcon, NextIcon] = dir === "rtl" ? [ArrowRight, ArrowLeft] : [ArrowLeft, ArrowRight];
  const position = { n: steps.indexOf(step) + 1, total: steps.length };
  const reason = invalid ? t(invalid, { min: FONT_SIZE_MIN, max: FONT_SIZE_MAX }) : null;

  return (
    <Dialog
      open
      $wide
      onClose={requestClose}
      title={t("export.wizard.title", { name: t(report.titleKey) })}
      footer={
        <>
          {reason ? (
            <Text id={reasonId} $size="sm" role="status">
              {reason}
            </Text>
          ) : null}
          <Button onClick={requestClose} disabled={busy}>
            {t("action.close")}
          </Button>
          {previousStep(move) ? (
            <Button onClick={() => goTo(previousStep(move))} disabled={busy}>
              <BackIcon size={ICON_SIZE} aria-hidden />
              {t("action.back")}
            </Button>
          ) : null}
          {isLast ? (
            <>
              <Button onClick={() => setSaving(true)} disabled={busy || reason !== null} aria-describedby={reason ? reasonId : undefined}>
                <Save size={ICON_SIZE} aria-hidden />
                {t("export.templates.saveAs")}
              </Button>
              <Button $variant="primary" onClick={download} disabled={busy || reason !== null} aria-describedby={reason ? reasonId : undefined}>
                <Download size={ICON_SIZE} aria-hidden />
                {t("export.download")}
              </Button>
            </>
          ) : (
            <Button $variant="primary" onClick={() => goTo(nextStep(move))} disabled={reason !== null} aria-describedby={reason ? reasonId : undefined}>
              {t("action.next")}
              <NextIcon size={ICON_SIZE} aria-hidden />
            </Button>
          )}
        </>
      }
    >
      <Stack ref={bodyRef} $gap="lg">
        <Stepper steps={steps} current={step} canJump={(target) => !busy && canJumpTo(target, move)} onJump={goTo} />
        <Heading as="h3" $size="lg" tabIndex={-1} ref={headingRef}>
          <VisuallyHidden>{t("export.stepOf", position)}: </VisuallyHidden>
          {t(titleKey)}
        </Heading>
        <Component state={state} dispatch={dispatch} page={page} defaults={defaults} fileTemplates={fileTemplates} />
        {isLast && progress ? <ProgressPanel progress={progress} onCancel={busy ? runner.cancel : undefined} /> : null}
      </Stack>

      <SaveTemplateDialog open={saving} onClose={() => setSaving(false)} state={state} page={page} fileTemplates={fileTemplates} />
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t("export.close.title")}
        footer={
          <>
            <Button onClick={() => setConfirming(false)}>{t("export.close.stay")}</Button>
            <Button $variant="primary" onClick={onClose}>
              {t("export.close.leave")}
            </Button>
          </>
        }
      >
        <Text>{t("export.close.body")}</Text>
      </Dialog>
    </Dialog>
  );
}
