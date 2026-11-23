"use client";

import { useState } from "react";
import { Button, Card, Dialog, Field, Input, Notice, Select, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { DESIGN_MODES, NAME_MAX, type FileDesign } from "../schema";
import { exportTemplates, fileTemplates as library, nameError, sorted } from "../templates";
import { ChoiceCards, Fieldset, Legend, Option } from "../ui";
import { DesignEditor, DesignPreview } from "./DesignEditor";
import type { StepProps } from "./types";

const NOT_PICKED = "";
type Outcome = { ok: boolean; text: string } | null;

/** Styling of the sheet: a saved style, or a custom one that can be saved as a style. */
export function FileTemplateStep({ state, dispatch, fileTemplates }: StepProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [deleting, setDeleting] = useState(false);

  const styles = sorted(fileTemplates);
  const picked = styles.find((style) => style.id === state.fileTemplateId);
  const invalidName = nameError(name, styles.map((style) => style.name));
  const patch = (next: Partial<typeof state>) => dispatch({ type: "patch", patch: next });
  const report = (ok: boolean, done: string) => setOutcome({ ok, text: ok ? done : t("export.storageFailed") });
  const setDesign = (design: FileDesign) => patch({ design });

  const pick = (id: string) => {
    const style = styles.find((candidate) => candidate.id === id);
    if (style) patch({ fileTemplateId: style.id, design: style.design });
  };
  const saveNew = () => {
    const created = library.create({ name, description: description.trim(), design: state.design });
    if (created) patch({ fileTemplateId: created.id });
    report(created !== null, t("export.design.saved", { name: name.trim() }));
    if (created) setName("");
  };
  const duplicate = () => {
    if (!picked) return;
    const copy = library.clone(picked.id, t("export.copyOf", { name: picked.name }).slice(0, NAME_MAX));
    report(copy !== null, t("export.design.duplicated", { name: picked.name }));
  };
  const remove = () => {
    if (!picked) return;
    const ok = library.remove(picked.id);
    if (ok) patch({ fileTemplateId: null });
    report(ok, t("export.design.deleted", { name: picked.name }));
    setDeleting(false);
  };
  // Export templates that point at this style fall back to the default styling once it is gone.
  const usedBy = picked ? exportTemplates.list().filter((template) => template.fileTemplateId === picked.id).length : 0;

  return (
    <>
      <ChoiceCards
        legend={t("export.design.mode")}
        name="export-design-mode"
        value={state.designMode}
        options={DESIGN_MODES.map((mode) => ({ value: mode, title: t(`export.design.mode.${mode}`), description: t(`export.design.mode.${mode}.desc`) }))}
        onChange={(designMode) => patch({ designMode })}
      />

      {state.designMode === "existing" && styles.length === 0 ? <Notice>{t("export.design.noStyles")}</Notice> : null}
      {state.designMode === "existing" && styles.length > 0 ? (
        <Stack $gap="sm">
          <Field label={t("export.design.pick")}>
            {(id) => (
              <Select id={id} value={picked?.id ?? NOT_PICKED} onChange={(event) => pick(event.target.value)}>
                <Option value={NOT_PICKED} disabled>
                  {t("export.design.choose")}
                </Option>
                {styles.map((style) => (
                  <Option key={style.id} value={style.id}>
                    {style.isDefault ? t("export.templates.defaultName", { name: style.name }) : style.name}
                  </Option>
                ))}
              </Select>
            )}
          </Field>
          {picked?.description ? (
            <Text $muted $size="sm">
              {picked.description}
            </Text>
          ) : null}
          {picked ? (
            <Stack $row $wrap $gap="sm">
              <Button onClick={() => report(library.setDefault(picked.id, !picked.isDefault), t("export.design.defaultChanged", { name: picked.name }))}>
                {t(picked.isDefault ? "export.templates.unsetDefault" : "export.templates.setDefault")}
              </Button>
              <Button onClick={duplicate}>{t("action.duplicate")}</Button>
              <Button onClick={() => setDeleting(true)}>{t("action.delete")}</Button>
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      {state.designMode === "custom" ? (
        <>
          <DesignEditor design={state.design} onChange={setDesign} />
          <Card>
            <Fieldset>
              <Legend>{t("export.design.save")}</Legend>
              <Field
                label={t("export.design.name")}
                hint={t("export.design.saveHint")}
                error={name && invalidName ? t(`export.name.${invalidName}`) : undefined}
              >
                {(id) => <Input id={id} value={name} maxLength={NAME_MAX} onChange={(event) => setName(event.target.value)} />}
              </Field>
              <Field label={t("export.design.description")}>
                {(id) => <Input id={id} value={description} maxLength={NAME_MAX} onChange={(event) => setDescription(event.target.value)} />}
              </Field>
              <Stack $row $wrap $gap="sm">
                <Button disabled={invalidName !== null} onClick={saveNew}>
                  {t("export.design.saveNew")}
                </Button>
                {picked ? (
                  <Button onClick={() => report(library.update(picked.id, { design: state.design }), t("export.design.updated", { name: picked.name }))}>
                    {t("export.design.update", { name: picked.name })}
                  </Button>
                ) : null}
              </Stack>
            </Fieldset>
          </Card>
        </>
      ) : null}

      {outcome ? (
        <Notice $tone={outcome.ok ? "success" : "danger"} role={outcome.ok ? "status" : "alert"}>
          {outcome.text}
        </Notice>
      ) : null}
      <DesignPreview design={state.design} />

      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={t("export.design.deleteTitle", { name: picked?.name ?? "" })}
        footer={
          <>
            <Button onClick={() => setDeleting(false)}>{t("action.cancel")}</Button>
            <Button $variant="primary" onClick={remove}>
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <Text>{usedBy > 0 ? t("export.design.deleteInUse", { count: usedBy }) : t("export.design.deleteBody")}</Text>
      </Dialog>
    </>
  );
}
