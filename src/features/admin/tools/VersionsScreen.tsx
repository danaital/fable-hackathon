"use client";

import { Pencil, Plus, Rocket, Trash } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, Field, Heading, Input, Ltr, Notice, Paragraph, Stack, Text, Textarea, useToast } from "@/components/ui";
import { ADMIN_AREA_MIN_ROLE } from "@/features/auth";
import { useI18n } from "@/i18n";
import { LOCALES, type Locale } from "@/lib/prefs";
import { isoToday } from "./files";
import { DataTable, type Column } from "./table";
import { AdminPage, ConfirmDialog, FormDialog, ICON_SIZE, IconButton, useSave } from "./ui";
import {
  EMPTY_DRAFT,
  TEXT_MAX,
  TITLE_MAX,
  VERSION_MAX,
  deleteRelease,
  releasePipeline,
  savePipeline,
  saveRelease,
  sortReleased,
  versionsStore,
  type ReleasedVersion,
  type VersionDraft,
  type VersionError,
} from "./versions";

const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = { en: "ltr", he: "rtl" };

interface Editing {
  /** Absent: the upcoming version. A number: that released version. */
  releasedId?: number;
  draft: VersionDraft;
  touched: boolean;
  error: VersionError | null;
}

/** The upcoming version and the released ones. The About page reads the same store through `useVersions()`. */
export function VersionsScreen() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const save = useSave();
  const state = versionsStore.useValue();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [deleting, setDeleting] = useState<ReleasedVersion | null>(null);
  const { pipeline } = state;
  const isUpcoming = editing?.releasedId === undefined;
  const draft = editing?.draft ?? EMPTY_DRAFT;

  const open = (source: VersionDraft, releasedId?: number) => setEditing({ releasedId, draft: source, touched: false, error: null });
  const change = (part: Partial<VersionDraft>) => setEditing((current) => current && { ...current, draft: { ...current.draft, ...part }, touched: true, error: null });

  const submit = () => {
    if (!editing) return;
    const result = isUpcoming ? savePipeline(state, draft) : saveRelease({ state, draft, editingId: editing.releasedId });
    if (!result.ok) return setEditing({ ...editing, error: result.error });
    if (save({ store: versionsStore, value: result.state, title: "adminTools.versions.saved" })) setEditing(null);
  };

  const release = () => {
    setReleasing(false);
    const result = releasePipeline({ state, releaseDate: "", nextVersion: "", today: isoToday() });
    if (!result.ok) return void toast.error({ title: `adminTools.versions.error.${result.error}` });
    save({ store: versionsStore, value: result.state, title: "adminTools.versions.released", titleVars: { version: pipeline?.version ?? "" } });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    save({ store: versionsStore, value: deleteRelease(state, deleting.id), title: "adminTools.versions.deleted", titleVars: { version: deleting.version } });
    setDeleting(null);
  };

  const columns: Column<ReleasedVersion>[] = [
    {
      key: "version",
      header: t("adminTools.versions.version"),
      cell: (row) => (
        <Badge>
          <Ltr>{row.version}</Ltr>
        </Badge>
      ),
    },
    { key: "title", header: t("adminTools.versions.titleColumn"), cell: (row) => row.title[locale] },
    { key: "date", header: t("adminTools.versions.releaseDate"), cell: (row) => (row.releaseDate ? <Ltr>{row.releaseDate}</Ltr> : <Text $muted>{t("adminTools.none")}</Text>) },
    { key: "notes", header: t("adminTools.versions.notes"), cell: (row) => row.summary[locale] },
    {
      key: "actions",
      header: t("adminTools.actions"),
      cell: (row) => (
        <Stack $row $gap="xs" $justify="end">
          <IconButton label={t("adminTools.versions.edit", { version: row.version })} icon={Pencil} onClick={() => open(row, row.id)} />
          <IconButton label={t("adminTools.versions.delete", { version: row.version })} icon={Trash} onClick={() => setDeleting(row)} />
        </Stack>
      ),
    },
  ];

  return (
    <AdminPage min={ADMIN_AREA_MIN_ROLE} rootOnly title={t("adminTools.versions.title")} description={t("adminTools.versions.desc")}>
      <Card>
        <Stack $gap="md">
          <Stack $row $wrap $gap="sm" $justify="space-between">
            <Heading as="h2" $size="lg">
              {t("adminTools.versions.upcoming")}
            </Heading>
            <Stack $row $wrap $gap="sm">
              <Button type="button" onClick={() => open(pipeline ?? EMPTY_DRAFT)}>
                {pipeline ? <Pencil size={ICON_SIZE} aria-hidden /> : <Plus size={ICON_SIZE} aria-hidden />}
                {t(pipeline ? "adminTools.versions.editUpcoming" : "adminTools.versions.addUpcoming")}
              </Button>
              {pipeline ? (
                <Button type="button" $variant="primary" onClick={() => setReleasing(true)}>
                  <Rocket size={ICON_SIZE} aria-hidden />
                  {t("adminTools.versions.release")}
                </Button>
              ) : null}
            </Stack>
          </Stack>
          {pipeline ? (
            <Stack $gap="sm">
              <Stack $row $wrap $gap="sm">
                <Badge $tone="info">
                  {t("adminTools.versions.upcomingBadge")} <Ltr>{pipeline.version}</Ltr>
                </Badge>
                <Text $medium>{pipeline.title[locale]}</Text>
                {pipeline.releaseDate ? (
                  <Text $muted $size="sm">
                    {t("adminTools.versions.plannedFor")} <Ltr>{pipeline.releaseDate}</Ltr>
                  </Text>
                ) : null}
              </Stack>
              <Paragraph $size="sm">{pipeline.summary[locale]}</Paragraph>
            </Stack>
          ) : (
            <Notice role="status">{t("adminTools.versions.noUpcoming")}</Notice>
          )}
        </Stack>
      </Card>

      <Heading as="h2" $size="lg">
        {t("adminTools.versions.releasedTitle")}
      </Heading>
      <DataTable caption={t("adminTools.versions.releasedTitle")} columns={columns} rows={sortReleased(state.released)} rowKey={(row) => row.id} empty={t("adminTools.versions.noReleased")} />

      <FormDialog
        open={editing !== null}
        title={t(isUpcoming ? "adminTools.versions.upcoming" : "adminTools.versions.editReleased")}
        dirty={Boolean(editing?.touched)}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitLabel={t("action.save")}
        error={editing?.error ? t(`adminTools.versions.error.${editing.error}`) : null}
      >
        <Field label={t("adminTools.versions.version")} hint={isUpcoming ? t("adminTools.versions.versionHint") : undefined}>
          {(id) => <Input id={id} dir="ltr" value={draft.version} maxLength={VERSION_MAX} required={!isUpcoming} onChange={(event) => change({ version: event.target.value })} />}
        </Field>
        <Field label={t(isUpcoming ? "adminTools.versions.plannedDate" : "adminTools.versions.releaseDate")}>
          {(id) => <Input id={id} type="date" value={draft.releaseDate ?? ""} onChange={(event) => change({ releaseDate: event.target.value || null })} />}
        </Field>
        {LOCALES.map((language) => (
          <Field key={language} label={t(`adminTools.versions.title.${language}`)}>
            {(id) => (
              <Input
                id={id}
                dir={LOCALE_DIR[language]}
                lang={language}
                value={draft.title[language]}
                maxLength={TITLE_MAX}
                required={!isUpcoming}
                onChange={(event) => change({ title: { ...draft.title, [language]: event.target.value } })}
              />
            )}
          </Field>
        ))}
        {LOCALES.map((language) => (
          <Field key={language} label={t(`adminTools.versions.notes.${language}`)}>
            {(id) => (
              <Textarea
                id={id}
                dir={LOCALE_DIR[language]}
                lang={language}
                value={draft.summary[language]}
                maxLength={TEXT_MAX}
                onChange={(event) => change({ summary: { ...draft.summary, [language]: event.target.value } })}
              />
            )}
          </Field>
        ))}
      </FormDialog>

      <ConfirmDialog open={releasing} title={t("adminTools.versions.release")} confirmLabel={t("adminTools.versions.release")} onConfirm={release} onClose={() => setReleasing(false)}>
        <Paragraph>
          {t("adminTools.versions.releaseConfirm")} <Ltr>{pipeline?.version}</Ltr>
        </Paragraph>
      </ConfirmDialog>
      <ConfirmDialog open={deleting !== null} title={t("adminTools.versions.deleteTitle")} confirmLabel={t("action.delete")} onConfirm={confirmDelete} onClose={() => setDeleting(null)} danger>
        <Paragraph>
          {t("adminTools.versions.deleteConfirm")} <Ltr>{deleting?.version}</Ltr>
        </Paragraph>
      </ConfirmDialog>
    </AdminPage>
  );
}
