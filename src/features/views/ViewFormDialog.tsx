"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, Dialog, Heading, Notice, Stack, Text } from "@/components/ui";
import type { ReportDef } from "@/data/types";
import { useI18n, type I18nKey } from "@/i18n";
import { validateName } from "./logic";
import { PAGE_TYPE, hydrateState, newViewId, type StoredState, type StoredView, type ViewEntry } from "./model";
import { Form, List, ListItem } from "./parts";
import { viewsRepository } from "./repository";
import { useViews } from "./useViews";
import { ViewDetailsFields, type ViewDetails } from "./ViewDetailsFields";
import { ViewPreview, useViewDescription } from "./ViewPreview";

export const VIEW_FORM_MODES = ["create", "update", "rename", "duplicate"] as const;
export type ViewFormMode = (typeof VIEW_FORM_MODES)[number];

export interface ViewFormRequest {
  mode: ViewFormMode;
  report: ReportDef;
  /** The state that will be stored: what is on screen, or the source view's own state. */
  state: StoredState;
  /** The view being updated, renamed or duplicated. */
  source?: ViewEntry;
}

interface ModeConfig {
  titleKey: I18nKey;
  submitKey: I18nKey;
  /** Writes over the source view instead of creating a new one. */
  keepsId: boolean;
  /** Replaces the stored state, so the user confirms first and may save a new view instead. */
  overwrites: boolean;
  showsPreview: boolean;
}

const MODES: Record<ViewFormMode, ModeConfig> = {
  create: { titleKey: "views.form.title.create", submitKey: "action.save", keepsId: false, overwrites: false, showsPreview: true },
  update: { titleKey: "views.form.title.update", submitKey: "views.form.update", keepsId: true, overwrites: true, showsPreview: true },
  rename: { titleKey: "views.form.title.rename", submitKey: "action.rename", keepsId: true, overwrites: false, showsPreview: false },
  duplicate: { titleKey: "views.form.title.duplicate", submitKey: "action.duplicate", keepsId: false, overwrites: false, showsPreview: true },
};

interface FormState extends ViewDetails {
  confirming: boolean;
  failed: boolean;
}

interface Props {
  /** `null` keeps the dialog closed. */
  request: ViewFormRequest | null;
  onClose: () => void;
  onSaved: (view: StoredView) => void;
}

/** Save, save as, update, rename and duplicate share this dialog: name, description, default, and a preview of the content. */
export function ViewFormDialog({ request, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const { views, defaults } = useViews();
  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const initialName = (next: ViewFormRequest | null): string => {
    if (!next?.source) return "";
    if (next.mode === "duplicate") return t("views.copyOf", { name: next.source.name });
    return MODES[next.mode].keepsId ? next.source.name : "";
  };
  const initialForm = (next: ViewFormRequest | null): FormState => ({
    name: initialName(next),
    description: next?.source?.description ?? "",
    makeDefault: next?.source !== undefined && MODES[next.mode].keepsId && defaults[next.source.reportId] === next.source.id,
    confirming: false,
    failed: false,
  });

  const [seen, setSeen] = useState(request);
  const [form, setForm] = useState<FormState>(() => initialForm(request));
  // Every opening starts from a fresh form.
  if (request !== seen) {
    setSeen(request);
    setForm(initialForm(request));
  }

  useEffect(() => {
    if (request) nameRef.current?.focus();
  }, [request]);

  const report = request?.report;
  const source = request?.source;
  const mode = request ? MODES[request.mode] : MODES.create;
  const taken = views.filter((view) => view.reportId === report?.id).map((view) => view.name);
  const nameError = (asNew: boolean) => validateName({ name: form.name, taken, ownName: mode.keepsId && !asNew ? source?.name : undefined });

  const commit = (asNew: boolean) => {
    if (!request || !report || nameError(asNew)) return;
    const keepsId = mode.keepsId && !asNew && source !== undefined;
    const view: StoredView = {
      id: keepsId ? source.id : newViewId(),
      name: form.name.trim(),
      description: form.description.trim(),
      reportId: report.id,
      pageType: PAGE_TYPE,
      state: request.state,
    };
    if (viewsRepository.saveWithDefault(view, form.makeDefault)) onSaved(view);
    else setForm({ ...form, confirming: false, failed: true });
  };

  const submit = () => {
    if (nameError(false)) return;
    if (mode.overwrites && !form.confirming) setForm({ ...form, confirming: true });
    else commit(false);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const footer = form.confirming ? (
    <>
      <Button onClick={() => setForm({ ...form, confirming: false })}>{t("action.back")}</Button>
      <Button $variant="primary" onClick={() => commit(false)}>
        {t("views.form.confirmUpdate")}
      </Button>
    </>
  ) : (
    <>
      <Button onClick={onClose}>{t("action.cancel")}</Button>
      {mode.overwrites ? (
        <Button disabled={nameError(true) !== null} onClick={() => commit(true)}>
          {t("views.form.saveAsNew")}
        </Button>
      ) : null}
      <Button type="submit" form={formId} $variant="primary" disabled={nameError(false) !== null}>
        {t(mode.submitKey)}
      </Button>
    </>
  );

  return (
    <Dialog open={request !== null} onClose={onClose} title={t(mode.titleKey)} footer={footer}>
      {form.failed ? (
        <Notice $tone="danger" role="alert">
          {t("views.saveFailed")}
        </Notice>
      ) : null}
      {report && form.confirming ? <Confirmation report={report} state={request.state} name={source?.name ?? form.name} /> : null}
      {report && !form.confirming ? (
        <>
          {mode.overwrites ? <Notice $tone="info">{t("views.form.updateInfo", { name: source?.name ?? "" })}</Notice> : null}
          <Form id={formId} onSubmit={onSubmit} noValidate>
            <ViewDetailsFields
              value={form}
              onChange={(details) => setForm({ ...form, ...details })}
              error={nameError(false)}
              onEnter={submit}
              nameRef={nameRef}
            />
          </Form>
          {mode.showsPreview ? (
            <Stack $gap="sm">
              <Heading as="h3" $size="md">
                {t("views.preview.title")}
              </Heading>
              <ViewPreview report={report} state={hydrateState(report, request.state)} />
            </Stack>
          ) : null}
        </>
      ) : null}
    </Dialog>
  );
}

/** The step before an update overwrites a view: what the view will contain afterwards, in counts. */
function Confirmation({ report, state, name }: { report: ReportDef; state: StoredState; name: string }) {
  const { t } = useI18n();
  const sections = useViewDescription(report, hydrateState(report, state));

  return (
    <Stack $gap="md">
      <Notice $tone="warning" role="alert">
        {t("views.form.confirmText", { name })}
      </Notice>
      <List>
        {sections
          .filter((section) => section.summary)
          .map((section) => (
            <ListItem key={section.id}>
              <Text $size="sm">{t("views.form.confirmCount", { section: section.title, count: section.summary })}</Text>
            </ListItem>
          ))}
      </List>
    </Stack>
  );
}
