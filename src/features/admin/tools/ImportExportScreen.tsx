"use client";

import { Download, Undo2, Upload } from "lucide-react";
import { useState } from "react";
import { Button, Card, Heading, Ltr, Notice, Paragraph, Stack, Text, useToast } from "@/components/ui";
import { REPORTS } from "@/data/reports";
import { ADMIN_AREA_MIN_ROLE } from "@/features/auth";
import { summaryConfigStore } from "@/features/summary/summaryConfig";
import { viewsRepository } from "@/features/views/repository";
import { translationOverridesStore, useI18n } from "@/i18n";
import { EXPORT_SUFFIX, IMPORT_KINDS, exportConfig, type FileError, type ImportKind } from "./configImport";
import { loadReportConfig } from "./configStore";
import { EXAMPLE_FILE_NAME, EXAMPLE_IMPORT, EXAMPLE_REPORT_ID } from "./example";
import { FilePicker, downloadJson, isoToday, type FileReadError } from "./files";
import { ImportPreview } from "./ImportPreview";
import { previewImport } from "./importRun";
import { lastImportStore, type ImportTarget } from "./lastImport";
import { dataModelRepository } from "./repository";
import { translationFile, translationRows } from "./translations";
import { AdminPage, ConfirmDialog, ICON_SIZE, SelectField } from "./ui";

const IMPORT_TARGETS: readonly ImportTarget[] = [...IMPORT_KINDS, "translations"];
const DEFAULT_TARGET: ImportTarget = "bundle";
const isTarget = (value: string): value is ImportTarget => IMPORT_TARGETS.some((target) => target === value);

type PickedFile = { name: string; text: string } | { error: FileReadError | FileError };

/** JSON export and import of report configuration and translations. A file is previewed first; nothing is stored before Apply. */
export function ImportExportScreen() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [reportId, setReportId] = useState(EXAMPLE_REPORT_ID);
  const [target, setTarget] = useState<ImportTarget>(DEFAULT_TARGET);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const last = lastImportStore.useValue();
  // Subscribed, so the preview below is compared again whenever one of the stores it reads changes.
  summaryConfigStore.useValue();
  dataModelRepository.useValue();
  viewsRepository.useList();
  const translations = translationOverridesStore.useValue();

  const preview = file && "text" in file ? previewImport({ text: file.text, target, reportId, locale }) : null;
  const fileError = file && "error" in file ? file.error : preview && !preview.ok ? preview.error : null;
  const plan = preview?.ok ? preview.value : null;
  const changes = plan ? plan.counts.create + plan.counts.update : 0;
  const reportTitle = (id: string) => {
    const report = REPORTS.find((item) => item.id === id);
    return report ? t(report.titleKey) : id;
  };

  const download = (fileName: string, value: unknown) => {
    downloadJson(fileName, value);
    toast.success({ title: "adminTools.importExport.exported", titleVars: { file: fileName } });
  };
  const exportKind = (kind: ImportKind) => download(`${reportId}-${EXPORT_SUFFIX[kind]}.json`, exportConfig(kind, reportId, loadReportConfig(reportId)));

  const apply = () => {
    if (!plan?.apply) return;
    const undo = plan.apply();
    if (!undo) return void toast.error({ title: "adminTools.importExport.applyFailed" });
    lastImportStore.set({ target, reportId: target === "translations" ? null : reportId, undo });
    toast.success({ title: "adminTools.importExport.applied", titleVars: { created: plan.counts.create, updated: plan.counts.update } });
  };

  const undoLast = () => {
    setConfirmingUndo(false);
    const result = last?.undo();
    if (result === "undone") lastImportStore.set(null);
    if (result === "undone") toast.success({ title: "adminTools.importExport.undone" });
    else if (result) toast.error({ title: `adminTools.importExport.undo.${result}` });
  };

  return (
    <AdminPage min={ADMIN_AREA_MIN_ROLE} title={t("adminTools.importExport.title")} description={t("adminTools.importExport.desc")}>
      <SelectField
        label={t("adminTools.report")}
        hint={t("adminTools.importExport.reportHint")}
        value={reportId}
        onChange={setReportId}
        options={REPORTS.map((report) => ({ value: report.id, label: t(report.titleKey) }))}
      />

      <Card>
        <Stack $gap="md">
          <Heading as="h2" $size="lg">
            {t("adminTools.importExport.exportTitle")}
          </Heading>
          <Paragraph $muted $size="sm">
            {t("adminTools.importExport.exportHint")}
          </Paragraph>
          <Stack $row $wrap $gap="sm">
            {IMPORT_KINDS.map((kind) => (
              <Button key={kind} type="button" onClick={() => exportKind(kind)}>
                <Download size={ICON_SIZE} aria-hidden />
                {t(`adminTools.target.${kind}`)}
              </Button>
            ))}
            <Button type="button" onClick={() => download(`translations-all-${isoToday()}.json`, translationFile(translationRows(translations)))}>
              <Download size={ICON_SIZE} aria-hidden />
              {t("adminTools.target.translations")}
            </Button>
          </Stack>
        </Stack>
      </Card>

      <Card>
        <Stack $gap="md">
          <Heading as="h2" $size="lg">
            {t("adminTools.importExport.importTitle")}
          </Heading>
          <Paragraph $muted $size="sm">
            {t("adminTools.importExport.importHint")}
          </Paragraph>
          <SelectField
            label={t("adminTools.importExport.target")}
            value={target}
            onChange={(value) => isTarget(value) && setTarget(value)}
            options={IMPORT_TARGETS.map((item) => ({ value: item, label: t(`adminTools.target.${item}`) }))}
          />
          <FilePicker label={t("adminTools.importExport.file")} onText={(text, name) => setFile({ name, text })} onError={(error) => setFile({ error })} />
          <Stack $row $wrap $gap="sm">
            <Button type="button" onClick={() => download(EXAMPLE_FILE_NAME, EXAMPLE_IMPORT)}>
              <Download size={ICON_SIZE} aria-hidden />
              {t("adminTools.importExport.example")}
            </Button>
            <Text $muted $size="sm">
              {t("adminTools.importExport.exampleHint")}
            </Text>
          </Stack>

          {fileError ? (
            <Notice $tone="danger" role="alert">
              {t(`adminTools.file.${fileError}`)}
            </Notice>
          ) : null}
          {file && "text" in file && plan ? (
            <Stack $gap="md">
              <Text $size="sm">
                {t("adminTools.importExport.previewOf", { target: t(`adminTools.target.${target}`), report: target === "translations" ? t("adminTools.importExport.allReports") : reportTitle(reportId) })}{" "}
                <Ltr>{file.name}</Ltr>
              </Text>
              <ImportPreview items={plan.items} counts={plan.counts} problems={plan.problems} />
              {plan.apply === null ? (
                <Notice $tone="danger" role="alert">
                  {t("adminTools.importExport.blocked")}
                </Notice>
              ) : changes === 0 ? (
                <Notice $tone="info" role="status">
                  {t("adminTools.importExport.nothingToDo")}
                </Notice>
              ) : null}
              <Stack $row $wrap $gap="sm">
                <Button type="button" $variant="primary" disabled={plan.apply === null || changes === 0} onClick={apply}>
                  <Upload size={ICON_SIZE} aria-hidden />
                  {t("adminTools.importExport.apply")}
                </Button>
                <Button type="button" onClick={() => setFile(null)}>
                  {t("action.clear")}
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </Card>

      {last ? (
        <Card>
          <Stack $row $wrap $gap="md" $justify="space-between">
            <Text $size="sm">
              {t("adminTools.importExport.lastImport", { target: t(`adminTools.target.${last.target}`), report: last.reportId ? reportTitle(last.reportId) : t("adminTools.importExport.allReports") })}
            </Text>
            <Button type="button" onClick={() => setConfirmingUndo(true)}>
              <Undo2 size={ICON_SIZE} aria-hidden />
              {t("adminTools.importExport.undo")}
            </Button>
          </Stack>
        </Card>
      ) : null}
      <ConfirmDialog open={confirmingUndo} title={t("adminTools.importExport.undo")} confirmLabel={t("adminTools.importExport.undo")} onConfirm={undoLast} onClose={() => setConfirmingUndo(false)} danger>
        <Paragraph>{t("adminTools.importExport.undoConfirm")}</Paragraph>
      </ConfirmDialog>
    </AdminPage>
  );
}
