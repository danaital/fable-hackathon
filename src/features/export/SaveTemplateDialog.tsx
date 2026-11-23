"use client";

import { useState } from "react";
import { Button, Dialog, Field, Input, Notice, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { PageContext } from "./plan";
import { NAME_MAX, type FileTemplate, type WizardState } from "./schema";
import { exportTemplates, nameError } from "./templates";
import { templateContent } from "./wizardState";

interface Props {
  open: boolean;
  onClose: () => void;
  state: WizardState;
  page: PageContext;
  fileTemplates: readonly FileTemplate[];
}

type Outcome = { ok: boolean; text: string } | null;

/** Saves the wizard's configuration as a new export template, or over the template it was started from. */
export function SaveTemplateDialog({ open, onClose, state, page, fileTemplates }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const source = page.templates.find((template) => template.id === state.templateId);
  // Unique among this report's templates, without regard to case.
  const invalid = nameError(name, page.templates.map((template) => template.name));

  const close = () => {
    setName("");
    setOutcome(null);
    onClose();
  };
  const report = (ok: boolean, savedName: string) => setOutcome({ ok, text: ok ? t("export.templates.saved", { name: savedName }) : t("export.storageFailed") });
  const content = () => templateContent(state, page, fileTemplates);
  const saveNew = () => report(exportTemplates.create({ ...content(), name, reportId: page.report.id }) !== null, name.trim());
  const update = () => {
    if (source) report(exportTemplates.update(source.id, content()), source.name);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("export.templates.saveTitle")}
      footer={
        outcome?.ok ? (
          <Button $variant="primary" onClick={close}>
            {t("action.done")}
          </Button>
        ) : (
          <>
            <Button onClick={close}>{t("action.cancel")}</Button>
            {source ? <Button onClick={update}>{t("export.templates.update", { name: source.name })}</Button> : null}
            <Button $variant="primary" disabled={invalid !== null} onClick={saveNew}>
              {t("export.templates.saveNew")}
            </Button>
          </>
        )
      }
    >
      <Text $muted $size="sm">
        {t("export.templates.saveInfo")}
      </Text>
      {outcome?.ok ? null : (
        <Field label={t("export.templates.name")} hint={t("export.templates.nameHint")} error={name && invalid ? t(`export.name.${invalid}`) : undefined}>
          {(id) => <Input id={id} value={name} maxLength={NAME_MAX} onChange={(event) => setName(event.target.value)} />}
        </Field>
      )}
      {outcome ? (
        <Notice $tone={outcome.ok ? "success" : "danger"} role={outcome.ok ? "status" : "alert"}>
          {outcome.text}
        </Notice>
      ) : null}
    </Dialog>
  );
}
