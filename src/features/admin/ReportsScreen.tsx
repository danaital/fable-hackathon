"use client";

import { Columns3, Plus, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Button, ButtonLink, Ltr, Notice, Paragraph, Stack, Text, useToast } from "@/components/ui";
import { useAuthStore } from "@/features/auth/session";
import { useI18n } from "@/i18n";
import { ALL_ROWS, ScreenHeader, Toolbar, contains, useAction } from "./kit";
import { deleteReport, registryStore, useReportDefs, type ReportView } from "./registry";
import { REPORT_ICON, ReportDialog, type ReportDialogRequest } from "./ReportDialog";
import { DataTable, type Column } from "./tools/table";
import { ConfirmDialog, ICON_SIZE, IconButton } from "./tools/ui";

const FIELDS_PATH = "/admin/fields";
/** The fields screen opens with this report selected (read in app/admin/fields/page.tsx). */
const REPORT_PARAM = "report";
const nothingToReload = () => undefined;

/** Report catalogue: built-in and custom reports, their settings, and creating or deleting a custom report. */
export function ReportsScreen() {
  const { t } = useI18n();
  const store = useAuthStore();
  const toast = useToast();
  const reports = useReportDefs();
  const { busy, run } = useAction(nothingToReload);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<ReportDialogRequest | null>(null);
  const [deleting, setDeleting] = useState<ReportView | null>(null);

  const remove = async () => {
    if (!deleting) return;
    const result = deleteReport(registryStore.read(), deleting.id);
    if (!result.ok) {
      toast.error({ title: `admin.reports.error.${result.error}` });
      return;
    }
    const done = await run(async () => {
      // Access rows go away with the report.
      await store.deleteReportAccess(deleting.id);
      registryStore.write(result.value);
      toast.success({ title: "admin.reports.deleted", titleVars: { name: deleting.title } });
    });
    if (done) setDeleting(null);
  };

  const columns: Column<ReportView>[] = [
    {
      key: "icon",
      header: t("admin.reports.icon"),
      cell: (report) => {
        const Icon = REPORT_ICON[report.icon];
        return <Icon size={ICON_SIZE} aria-hidden />;
      },
    },
    { key: "title", header: t("admin.report.title"), cell: (report) => <Text $medium>{report.title}</Text> },
    { key: "id", header: t("admin.report.id"), cell: (report) => <Ltr>{report.id}</Ltr> },
    { key: "description", header: t("admin.reports.description"), cell: (report) => <Text $muted>{report.description}</Text> },
    { key: "source", header: t("admin.reports.source"), cell: (report) => <Ltr>{report.source}</Ltr> },
    {
      key: "tags",
      header: t("admin.reports.tags"),
      cell: (report) => (
        <Stack $row $wrap $gap="xs">
          {report.tags.map((tag) => (
            <Badge key={tag}>{t(`tag.${tag}`)}</Badge>
          ))}
        </Stack>
      ),
    },
    { key: "kind", header: t("admin.reports.kind"), cell: (report) => <Badge $tone={report.custom ? "info" : "neutral"}>{t(report.custom ? "admin.reports.custom" : "admin.reports.builtIn")}</Badge> },
    {
      key: "actions",
      header: t("admin.actions"),
      cell: (report) => (
        <Stack $row $gap="xs">
          <IconButton label={t("admin.reports.edit", { name: report.title })} icon={Settings} onClick={() => setDialog({ report })} />
          <ButtonLink
            $variant="ghost"
            $icon
            href={`${FIELDS_PATH}?${REPORT_PARAM}=${encodeURIComponent(report.id)}`}
            aria-label={t("admin.reports.openFields", { name: report.title })}
            title={t("admin.reports.openFields", { name: report.title })}
          >
            <Columns3 size={ICON_SIZE} aria-hidden />
          </ButtonLink>
          {/* Built-in reports ship with the app and cannot be deleted. */}
          {report.custom ? <IconButton label={t("admin.reports.delete", { name: report.title })} icon={Trash2} disabled={busy} onClick={() => setDeleting(report)} /> : null}
        </Stack>
      ),
    },
  ];

  return (
    <Stack $gap="lg">
      <ScreenHeader titleKey="admin.nav.reports" descKey="admin.reports.desc" />
      <Notice $tone="info" role="note">
        <Text $size="sm">{t("admin.reports.notWired")}</Text>
      </Notice>
      <Toolbar search={{ value: query, onChange: setQuery, label: t("admin.access.search") }}>
        <Button type="button" $variant="primary" onClick={() => setDialog({ report: null })}>
          <Plus size={ICON_SIZE} aria-hidden />
          {t("admin.reports.create")}
        </Button>
      </Toolbar>
      <DataTable
        caption={t("admin.nav.reports")}
        columns={columns}
        rows={reports.filter((report) => contains(query, [report.id, report.title, report.description, report.source]))}
        rowKey={(report) => report.id}
        empty={t("admin.noMatch")}
        pageSize={ALL_ROWS}
      />
      <ReportDialog request={dialog} onClose={() => setDialog(null)} />
      <ConfirmDialog danger open={deleting !== null} title={t("admin.reports.deleteTitle")} confirmLabel={t("action.delete")} onConfirm={() => void remove()} onClose={() => setDeleting(null)}>
        <Paragraph>{t("admin.reports.deleteBody", { name: deleting?.title ?? "" })}</Paragraph>
      </ConfirmDialog>
    </Stack>
  );
}
