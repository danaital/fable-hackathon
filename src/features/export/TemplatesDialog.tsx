"use client";

import { useState } from "react";
import { Badge, Button, Card, Dialog, Field, Input, Notice, Stack, Text } from "@/components/ui";
import { useReport } from "@/features/report/ReportContext";
import { useI18n } from "@/i18n";
import { DefinitionSummary } from "./DefinitionSummary";
import type { PageContext } from "./plan";
import { NAME_MAX, type ExportTemplate } from "./schema";
import { exportTemplates, nameError, sorted } from "./templates";
import { Disclosure, DisclosureSummary } from "./ui";

type Mode = "rename" | "delete";
type Outcome = { ok: boolean; text: string } | null;

interface CardProps {
  template: ExportTemplate;
  page: PageContext;
  onExport: (template: ExportTemplate) => void;
  onOpen: (template: ExportTemplate) => void;
  onOutcome: (ok: boolean, done: string) => void;
}

function TemplateCard({ template, page, onExport, onOpen, onOutcome }: CardProps) {
  const { t } = useI18n();
  const { format } = useReport();
  const [mode, setMode] = useState<Mode | null>(null);
  const [name, setName] = useState(template.name);
  const others = page.templates.filter((other) => other.id !== template.id).map((other) => other.name);
  const invalid = nameError(name, others);
  const done = (ok: boolean, text: string) => {
    onOutcome(ok, text);
    setMode(null);
  };

  return (
    <Card>
      <Stack $gap="sm">
        <Stack $row $wrap $gap="sm">
          <Text $medium>{template.name}</Text>
          <Badge $tone="info">{template.format.toUpperCase()}</Badge>
          {/* Status as text, never by colour alone. */}
          {template.isDefault ? <Badge $tone="success">{t("export.templates.default")}</Badge> : null}
          <Text $muted $size="xs">
            {t("export.templates.updated", { date: format.date(template.updatedAt) })}
          </Text>
        </Stack>

        <Disclosure>
          <DisclosureSummary>{t("export.templates.details")}</DisclosureSummary>
          <DefinitionSummary fields={page.report.fields} columns={template.columns} sorts={template.sorts} filters={template.filters} />
        </Disclosure>

        {mode === "rename" ? (
          <Stack $row $wrap $gap="sm" $align="end">
            <Field label={t("export.templates.name")} error={invalid ? t(`export.name.${invalid}`) : undefined}>
              {(id) => <Input id={id} value={name} maxLength={NAME_MAX} onChange={(event) => setName(event.target.value)} />}
            </Field>
            <Button
              $variant="primary"
              disabled={invalid !== null}
              onClick={() => done(exportTemplates.update(template.id, { name: name.trim() }), t("export.templates.renamed", { name: name.trim() }))}
            >
              {t("action.save")}
            </Button>
            <Button onClick={() => setMode(null)}>{t("action.cancel")}</Button>
          </Stack>
        ) : null}

        {mode === "delete" ? (
          <Notice $tone="danger" role="alert">
            <Text $size="sm">{t("export.templates.deleteConfirm", { name: template.name })}</Text>
            <Button onClick={() => done(exportTemplates.remove(template.id), t("export.templates.deleted", { name: template.name }))}>
              {t("action.delete")}
            </Button>
            <Button onClick={() => setMode(null)}>{t("action.cancel")}</Button>
          </Notice>
        ) : null}

        {mode === null ? (
          <Stack $row $wrap $gap="sm">
            <Button $variant="primary" onClick={() => onExport(template)}>
              {t("export.templates.exportNow")}
            </Button>
            <Button onClick={() => onOpen(template)}>{t("export.templates.openInWizard")}</Button>
            <Button onClick={() => setMode("rename")}>{t("action.rename")}</Button>
            <Button
              onClick={() => {
                const copy = exportTemplates.clone(template.id, t("export.copyOf", { name: template.name }).slice(0, NAME_MAX));
                onOutcome(copy !== null, t("export.templates.duplicated", { name: template.name }));
              }}
            >
              {t("action.duplicate")}
            </Button>
            <Button
              onClick={() =>
                onOutcome(exportTemplates.setDefault(template.id, !template.isDefault), t("export.templates.defaultChanged", { name: template.name }))
              }
            >
              {t(template.isDefault ? "export.templates.unsetDefault" : "export.templates.setDefault")}
            </Button>
            <Button onClick={() => setMode("delete")}>{t("action.delete")}</Button>
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  page: PageContext;
  /** Build the file now, with no wizard. */
  onExport: (template: ExportTemplate) => void;
  /** Open the wizard with the template applied. */
  onOpen: (template: ExportTemplate) => void;
}

/** This report's saved export templates: run, open, rename, duplicate, set as default, delete. */
export function TemplatesDialog({ open, onClose, page, onExport, onOpen }: Props) {
  const { t } = useI18n();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const templates = sorted(page.templates);
  const onOutcome = (ok: boolean, done: string) => setOutcome({ ok, text: ok ? done : t("export.storageFailed") });

  return (
    <Dialog
      open={open}
      $wide
      onClose={onClose}
      title={t("export.templates.title", { name: t(page.report.titleKey) })}
      footer={<Button onClick={onClose}>{t("action.close")}</Button>}
    >
      <Text $muted $size="sm">
        {t("export.templates.info")}
      </Text>
      {outcome ? (
        <Notice $tone={outcome.ok ? "success" : "danger"} role={outcome.ok ? "status" : "alert"}>
          {outcome.text}
        </Notice>
      ) : null}
      {templates.length === 0 ? <Notice>{t("export.templates.empty")}</Notice> : null}
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} page={page} onExport={onExport} onOpen={onOpen} onOutcome={onOutcome} />
      ))}
    </Dialog>
  );
}
