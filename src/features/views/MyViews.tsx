"use client";

import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { Badge, Button, Dialog, Grid, Heading, Input, Link, Ltr, Notice, Stack, Text, VisuallyHidden } from "@/components/ui";
import type { ReportDef } from "@/data/types";
import { useI18n, type I18nKey } from "@/i18n";
import { groupViews, matchesSearch } from "./logic";
import { PAGE_TYPE, REPORT_PARAM, reportViewHref, type StoredView, type ViewEntry } from "./model";
import { viewsRepository } from "./repository";
import { useViews } from "./useViews";
import { ViewCard, type CardAction } from "./ViewCard";
import { ViewFormDialog, type ViewFormRequest } from "./ViewFormDialog";
import { ViewWizard } from "./ViewWizard";

const ICON_SIZE = 16;
const DELETED_KEY: I18nKey = "views.deleted";

interface Announcement {
  key: I18nKey;
  name: string;
}

interface WizardState {
  /** Counts openings, so every opening starts from a fresh wizard. */
  run: number;
  open: boolean;
  editing: ViewEntry | null;
}

/** Every saved view, grouped by report: open, star, set as default, rename, edit, duplicate, delete and create. */
export function MyViews({ reports }: { reports: readonly ReportDef[] }) {
  // useSearchParams needs a Suspense boundary so the page can still be prerendered.
  return (
    <Suspense fallback={null}>
      <MyViewsContent reports={reports} />
    </Suspense>
  );
}

function MyViewsContent({ reports }: { reports: readonly ReportDef[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { views, defaults, favorites } = useViews();
  const searchId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [search, setSearch] = useState("");
  const [reportId, setReportId] = useState<string | null>(() => reports.find((report) => report.id === params.get(REPORT_PARAM))?.id ?? null);
  const [request, setRequest] = useState<ViewFormRequest | null>(null);
  const [deleting, setDeleting] = useState<ViewEntry | null>(null);
  const [wizard, setWizard] = useState<WizardState>({ run: 0, open: false, editing: null });
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [failed, setFailed] = useState(false);

  // Per report: the user's default first, then favorites, the other custom views, and system views last.
  const sections = reports
    .filter((report) => reportId === null || report.id === reportId)
    .map((report) => {
      const title = t(report.titleKey);
      const matching = views.filter((view) => view.reportId === report.id && matchesSearch({ view, term: search, extra: title }));
      const groups = groupViews({ views: matching, defaultId: defaults[report.id] ?? "", favorites });
      const userDefault = groups.default.filter((view) => view.id === defaults[report.id]);
      const systemFirst = groups.default.filter((view) => view.id !== defaults[report.id]);
      return { report, title, views: [...userDefault, ...groups.favorites, ...groups.custom, ...systemFirst, ...groups.system] };
    })
    .filter((section) => section.views.length > 0);

  const openWizard = (editing: ViewEntry | null) => setWizard({ run: wizard.run + 1, open: true, editing });
  const closeWizard = () => setWizard((current) => ({ ...current, open: false }));

  const actions: Record<CardAction, (view: ViewEntry, report: ReportDef) => void> = {
    rename: (view, report) => setRequest({ mode: "rename", report, state: view.state, source: view }),
    duplicate: (view, report) => setRequest({ mode: "duplicate", report, state: view.state, source: view }),
    edit: (view) => openWizard(view),
    delete: (view) => setDeleting(view),
  };

  const onSaved = (saved: StoredView) => {
    setRequest(null);
    setAnnouncement({ key: "views.bar.saved", name: saved.name });
  };

  const onWizardDone = (saved: StoredView) => {
    closeWizard();
    // A new view opens on its report; an edited one stays in the list.
    if (wizard.editing) setAnnouncement({ key: "views.bar.saved", name: saved.name });
    else router.push(reportViewHref(saved));
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const removed = viewsRepository.remove(deleting.id);
    setFailed(!removed);
    if (removed) setAnnouncement({ key: DELETED_KEY, name: deleting.name });
    setDeleting(null);
  };

  // After a delete the card that had focus is gone; once the dialog has closed, move focus to the page heading.
  useEffect(() => {
    if (announcement?.key === DELETED_KEY) headingRef.current?.focus();
  }, [announcement]);

  return (
    <Stack $gap="xl">
      <Stack $gap="md">
        <Stack $row $wrap $gap="md" $justify="space-between">
          <Heading ref={headingRef} tabIndex={-1}>
            {t("nav.views")}
          </Heading>
          <Button $variant="primary" onClick={() => openWizard(null)}>
            <Plus size={ICON_SIZE} aria-hidden />
            {t("views.page.create")}
          </Button>
        </Stack>
        <Text $muted $size="sm">
          {t("views.page.intro")}
        </Text>
        <VisuallyHidden as="label" htmlFor={searchId}>
          {t("views.page.search")}
        </VisuallyHidden>
        <Input id={searchId} type="search" value={search} placeholder={t("views.page.search")} onChange={(event) => setSearch(event.target.value)} />
        <Stack $row $wrap $gap="sm" role="group" aria-label={t("views.page.reports")}>
          <Button $active={reportId === null} aria-pressed={reportId === null} onClick={() => setReportId(null)}>
            {t("views.page.allReports")}
          </Button>
          {reports.map((report) => (
            <Button key={report.id} $active={reportId === report.id} aria-pressed={reportId === report.id} onClick={() => setReportId(report.id)}>
              {t(report.titleKey)}
            </Button>
          ))}
        </Stack>
        <Text $size="sm" role="status">
          {announcement ? t(announcement.key, { name: announcement.name }) : null}
        </Text>
        {failed ? (
          <Notice $tone="danger" role="alert">
            {t("views.saveFailed")}
          </Notice>
        ) : null}
      </Stack>

      {sections.length === 0 ? <Notice>{t("views.page.empty")}</Notice> : null}
      {sections.map(({ report, title, views: reportViews }) => (
        <Stack as="section" key={report.id} $gap="md" aria-label={title}>
          <Stack $row $wrap $gap="sm">
            <Heading as="h2" $size="lg">
              <Link href={`/report/${encodeURIComponent(report.id)}/${PAGE_TYPE}`}>{title}</Link>
            </Heading>
            <Badge title={t("views.page.count", { count: reportViews.length })}>
              <Ltr>{reportViews.length}</Ltr>
            </Badge>
          </Stack>
          <Grid $min="320px">
            {reportViews.map((view) => (
              <ViewCard
                key={view.id}
                view={view}
                report={report}
                isDefault={defaults[report.id] === view.id}
                isFavorite={favorites.has(view.id)}
                onAction={(action, target) => actions[action](target, report)}
              />
            ))}
          </Grid>
        </Stack>
      ))}

      <ViewFormDialog request={request} onClose={() => setRequest(null)} onSaved={onSaved} />
      <ViewWizard
        key={wizard.run}
        open={wizard.open}
        reports={reports}
        reportId={reportId ?? undefined}
        editing={wizard.editing}
        onClose={closeWizard}
        onDone={onWizardDone}
      />
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t("views.delete.title")}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>{t("action.cancel")}</Button>
            <Button $variant="primary" onClick={confirmDelete}>
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <Text>{t("views.delete.text", { name: deleting?.name ?? "" })}</Text>
      </Dialog>
    </Stack>
  );
}
