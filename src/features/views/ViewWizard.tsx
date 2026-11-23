"use client";

import { useState, type ReactNode } from "react";
import { Button, Dialog, Field, Heading, Notice, Paragraph, Radio, Select, Stack, Text } from "@/components/ui";
import type { ReportDef } from "@/data/types";
import { defaultViewState, type ViewState } from "@/features/report/viewState";
import { useI18n, type I18nKey } from "@/i18n";
import { validateName } from "./logic";
import { PAGE_TYPE, hydrateState, newViewId, snapshotState, type StoredView, type ViewEntry } from "./model";
import { Fieldset, Legend, Option } from "./parts";
import { viewsRepository } from "./repository";
import { useViews } from "./useViews";
import { ViewDetailsFields, type ViewDetails } from "./ViewDetailsFields";
import { ViewPreview } from "./ViewPreview";
import { WizardFilters, filtersComplete } from "./WizardFilters";
import { WizardColumns, WizardPage, WizardSorts } from "./wizardSteps";

export const WIZARD_STEPS = ["details", "columns", "filters", "page", "review"] as const;
type StepId = (typeof WIZARD_STEPS)[number];

const STEP_TITLES: Record<StepId, I18nKey> = {
  details: "views.wizard.step.details",
  columns: "views.wizard.step.columns",
  filters: "views.wizard.step.filters",
  page: "views.wizard.step.page",
  review: "views.wizard.step.review",
};
const START_NAME = "view-wizard-start";

interface Draft extends ViewDetails {
  reportId: string;
  /** View this one starts as a copy of; `null` starts from the report's defaults. */
  sourceId: string | null;
  state: ViewState;
}

interface Props {
  open: boolean;
  /** Reports a new view can be made for; the first one is preselected unless `reportId` says otherwise. */
  reports: readonly ReportDef[];
  reportId?: string;
  /** The view to edit. Absent: create a new one. */
  editing?: ViewEntry | null;
  onClose: () => void;
  onDone: (view: StoredView) => void;
}

/**
 * Create or edit a view step by step. Mount it with a new `key` for every opening: the draft starts from its props.
 * Closing with work in progress asks before discarding it.
 */
export function ViewWizard({ open, reports, reportId, editing, onClose, onDone }: Props) {
  const { t } = useI18n();
  const { views, defaults } = useViews();
  const reportOf = (id: string) => reports.find((report) => report.id === id) ?? reports[0];

  const [draft, setDraft] = useState<Draft>(() => {
    const report = reportOf(editing?.reportId ?? reportId ?? "");
    return {
      reportId: report.id,
      sourceId: null,
      name: editing?.name ?? "",
      description: editing?.description ?? "",
      makeDefault: editing !== null && editing !== undefined && defaults[editing.reportId] === editing.id,
      state: editing ? hydrateState(report, editing.state) : defaultViewState(report),
    };
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [failed, setFailed] = useState(false);

  const report = reportOf(draft.reportId);
  const reportViews = views.filter((view) => view.reportId === report.id);
  const step = WIZARD_STEPS[stepIndex];
  const nameError = validateName({ name: draft.name, taken: reportViews.map((view) => view.name), ownName: editing?.name });
  const valid: Record<StepId, boolean> = {
    details: nameError === null,
    columns: draft.state.columns.length > 0,
    filters: filtersComplete(report, draft.state.filters),
    page: true,
    review: true,
  };
  const blockedIndex = WIZARD_STEPS.findIndex((id) => !valid[id]);
  const reachable = (index: number) => blockedIndex === -1 || index <= blockedIndex;

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setTouched(true);
  };
  const updateState = (patch: Partial<ViewState>) => update({ state: { ...draft.state, ...patch } });
  // Starting point: the report's defaults, or a copy of one of its views. Changing it refills every later step.
  const startFrom = (next: ReportDef, sourceId: string | null) => {
    const source = views.find((view) => view.id === sourceId);
    update({ reportId: next.id, sourceId: source?.id ?? null, state: source ? hydrateState(next, source.state) : defaultViewState(next) });
  };

  const requestClose = () => {
    if (touched) setConfirmingDiscard(true);
    else onClose();
  };

  const finish = () => {
    const view: StoredView = {
      id: editing?.id ?? newViewId(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      reportId: report.id,
      pageType: PAGE_TYPE,
      state: snapshotState(draft.state),
    };
    if (viewsRepository.saveWithDefault(view, draft.makeDefault)) onDone(view);
    else setFailed(true);
  };

  const details = (
    <Stack $gap="lg">
      {editing ? null : (
        <>
          {reports.length > 1 ? (
            <Field label={t("views.wizard.report")}>
              {(id) => (
                <Select id={id} value={report.id} onChange={(event) => startFrom(reportOf(event.target.value), null)}>
                  {reports.map((option) => (
                    <Option key={option.id} value={option.id}>
                      {t(option.titleKey)}
                    </Option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <Fieldset>
            <Legend>{t("views.wizard.start")}</Legend>
            <Radio name={START_NAME} checked={draft.sourceId === null} onChange={() => startFrom(report, null)}>
              {t("views.wizard.start.scratch")}
            </Radio>
            <Radio
              name={START_NAME}
              checked={draft.sourceId !== null}
              disabled={reportViews.length === 0}
              onChange={() => startFrom(report, reportViews[0]?.id ?? null)}
            >
              {t("views.wizard.start.copy")}
            </Radio>
            {draft.sourceId !== null ? (
              <Select aria-label={t("views.wizard.start.source")} value={draft.sourceId} onChange={(event) => startFrom(report, event.target.value)}>
                {reportViews.map((view) => (
                  <Option key={view.id} value={view.id}>
                    {view.name}
                  </Option>
                ))}
              </Select>
            ) : null}
          </Fieldset>
        </>
      )}
      <ViewDetailsFields value={draft} onChange={(next) => update(next)} error={nameError} />
    </Stack>
  );

  const stepProps = { report, state: draft.state, onChange: updateState };
  const bodies: Record<StepId, ReactNode> = {
    details,
    columns: <WizardColumns {...stepProps} />,
    filters: (
      <Stack $gap="xl">
        <WizardFilters {...stepProps} />
        <WizardSorts {...stepProps} />
      </Stack>
    ),
    page: <WizardPage {...stepProps} />,
    review: (
      <Stack $gap="md">
        <Heading as="h3" $size="md">
          {draft.name.trim()}
        </Heading>
        {draft.description.trim() ? <Paragraph $muted>{draft.description.trim()}</Paragraph> : null}
        <Text $size="sm">{t("views.wizard.reviewReport", { report: t(report.titleKey) })}</Text>
        <ViewPreview report={report} state={draft.state} />
      </Stack>
    ),
  };

  const isLast = stepIndex === WIZARD_STEPS.length - 1;
  const footer = (
    <>
      <Button onClick={requestClose}>{t("action.cancel")}</Button>
      <Button disabled={stepIndex === 0} onClick={() => setStepIndex(stepIndex - 1)}>
        {t("action.back")}
      </Button>
      {isLast ? (
        <Button $variant="primary" disabled={blockedIndex !== -1} onClick={finish}>
          {t(editing ? "views.wizard.update" : "views.wizard.create")}
        </Button>
      ) : (
        <Button $variant="primary" disabled={!valid[step]} onClick={() => setStepIndex(stepIndex + 1)}>
          {t("action.next")}
        </Button>
      )}
    </>
  );

  return (
    <>
      <Dialog
        open={open && !confirmingDiscard}
        onClose={requestClose}
        title={t(editing ? "views.wizard.title.edit" : "views.wizard.title.create")}
        footer={footer}
        $wide
      >
        <Stack $row $wrap $gap="md" $justify="space-between">
          <Text $size="sm" role="status">
            {t("views.wizard.progress", { n: stepIndex + 1, total: WIZARD_STEPS.length, step: t(STEP_TITLES[step]) })}
            {blockedIndex === -1 ? null : ` ${t("views.wizard.blocked", { step: t(STEP_TITLES[WIZARD_STEPS[blockedIndex]]) })}`}
          </Text>
          <Select aria-label={t("views.wizard.goTo")} value={stepIndex} onChange={(event) => setStepIndex(Number(event.target.value))}>
            {WIZARD_STEPS.map((id, index) => (
              <Option key={id} value={index} disabled={!reachable(index)}>
                {t("views.wizard.stepOption", { n: index + 1, step: t(STEP_TITLES[id]) })}
              </Option>
            ))}
          </Select>
        </Stack>
        {failed ? (
          <Notice $tone="danger" role="alert">
            {t("views.saveFailed")}
          </Notice>
        ) : null}
        {bodies[step]}
      </Dialog>
      <Dialog
        open={open && confirmingDiscard}
        onClose={() => setConfirmingDiscard(false)}
        title={t("views.wizard.discard.title")}
        footer={
          <>
            <Button onClick={() => setConfirmingDiscard(false)}>{t("views.discard.keep")}</Button>
            <Button $variant="primary" onClick={onClose}>
              {t("views.wizard.discard.confirm")}
            </Button>
          </>
        }
      >
        <Text>{t("views.wizard.discard.text")}</Text>
      </Dialog>
    </>
  );
}
