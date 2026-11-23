"use client";

import { Download, Pencil, Plus, RotateCcw, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Checkbox, Field, Input, Ltr, Paragraph, Stack, Text, Textarea } from "@/components/ui";
import { ADMIN_AREA_MIN_ROLE } from "@/features/auth";
import { translationOverridesStore, useI18n, type I18nKey } from "@/i18n";
import { downloadJson, isoToday } from "./files";
import { NAME_MAX, TEXT_MAX } from "./model";
import { DataTable, type Column } from "./table";
import {
  filterRows,
  isTranslationKey,
  isUntranslated,
  resetTranslation,
  saveTranslation,
  translationFile,
  translationRows,
  type TranslationDraft,
  type TranslationError,
  type TranslationRow,
} from "./translations";
import { AdminPage, ConfirmDialog, FormDialog, ICON_SIZE, IconButton, LangText, SearchBox, useSave } from "./ui";

const PAGE_SIZE = 40;
const TEXT_ROWS = 3;
const EMPTY_DRAFT: TranslationDraft = { key: "", en: "", he: "" };
const ERROR_TEXT: Record<TranslationError, I18nKey> = {
  key: "adminTools.issue.translationKey",
  text: "adminTools.translations.textRequired",
  tooLong: "adminTools.translations.tooLong",
};

interface Editing {
  draft: TranslationDraft;
  isNew: boolean;
  touched: boolean;
  error: I18nKey | null;
}

/** The text of every key in both languages. Edits are stored as overrides on top of the texts shipped with the app. */
export function TranslationsScreen() {
  const { t } = useI18n();
  const save = useSave();
  const overrides = translationOverridesStore.useValue();
  const [query, setQuery] = useState("");
  const [untranslatedOnly, setUntranslatedOnly] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [resetting, setResetting] = useState<TranslationRow | null>(null);

  const rows = useMemo(() => translationRows(overrides), [overrides]);
  const untranslated = useMemo(() => rows.filter(isUntranslated), [rows]);
  const shown = filterRows(rows, { query, untranslatedOnly });

  const open = (draft: TranslationDraft, isNew: boolean) => setEditing({ draft, isNew, touched: false, error: null });
  const change = (part: Partial<TranslationDraft>) => setEditing((current) => current && { ...current, draft: { ...current.draft, ...part }, touched: true, error: null });
  const draft = editing?.draft ?? EMPTY_DRAFT;
  const keyTaken = Boolean(editing?.isNew) && rows.some((row) => row.key === draft.key);
  const keyError = !editing?.isNew || !draft.key ? undefined : keyTaken ? t("adminTools.translations.keyExists") : isTranslationKey(draft.key) ? undefined : t("adminTools.issue.translationKey");

  const submit = () => {
    if (!editing || keyTaken) return;
    const result = saveTranslation(overrides, draft);
    if (!result.ok) return setEditing({ ...editing, error: ERROR_TEXT[result.error] });
    if (save({ store: translationOverridesStore, value: result.value, title: "adminTools.translations.saved", titleVars: { key: draft.key } })) setEditing(null);
  };

  const confirmReset = () => {
    if (!resetting) return;
    const title = resetting.builtIn ? "adminTools.translations.wasReset" : "adminTools.translations.deleted";
    save({ store: translationOverridesStore, value: resetTranslation(overrides, resetting.key), title, titleVars: { key: resetting.key } });
    setResetting(null);
  };

  const exportRows = (prefix: string, list: readonly TranslationRow[]) => downloadJson(`${prefix}-${isoToday()}.json`, translationFile(list));

  const columns: Column<TranslationRow>[] = [
    { key: "key", header: t("adminTools.translations.key"), cell: (row) => <Ltr>{row.key}</Ltr> },
    { key: "en", header: t("adminTools.translations.en"), cell: (row) => <LangText dir="ltr" lang="en">{row.en}</LangText> },
    { key: "he", header: t("adminTools.translations.he"), cell: (row) => <LangText dir="rtl" lang="he">{row.he}</LangText> },
    {
      key: "state",
      header: t("adminTools.translations.state"),
      cell: (row) =>
        row.changed ? <Badge $tone={row.builtIn ? "info" : "success"}>{t(row.builtIn ? "adminTools.translations.changed" : "adminTools.translations.added")}</Badge> : <Text $muted>{t("adminTools.translations.builtIn")}</Text>,
    },
    {
      key: "actions",
      header: t("adminTools.actions"),
      cell: (row) => (
        <Stack $row $gap="xs" $justify="end">
          <IconButton label={t("adminTools.translations.edit", { key: row.key })} icon={Pencil} onClick={() => open({ key: row.key, en: row.en, he: row.he }, false)} />
          {row.changed ? (
            <IconButton
              label={t(row.builtIn ? "adminTools.translations.reset" : "adminTools.translations.delete", { key: row.key })}
              icon={row.builtIn ? RotateCcw : Trash}
              onClick={() => setResetting(row)}
            />
          ) : null}
        </Stack>
      ),
    },
  ];

  return (
    <AdminPage min={ADMIN_AREA_MIN_ROLE} title={t("adminTools.translations.title")} description={t("adminTools.translations.desc")}>
      <Stack $row $wrap $gap="sm">
        <SearchBox value={query} onChange={setQuery} label={t("adminTools.translations.search")} />
        <Checkbox checked={untranslatedOnly} onChange={setUntranslatedOnly}>
          {t("adminTools.translations.untranslatedOnly")}
        </Checkbox>
        <Button type="button" disabled={untranslated.length === 0} onClick={() => exportRows("untranslated", untranslated)}>
          <Download size={ICON_SIZE} aria-hidden />
          {t("adminTools.translations.exportUntranslated", { count: untranslated.length })}
        </Button>
        <Button type="button" disabled={rows.length === 0} onClick={() => exportRows("translations-all", rows)}>
          <Download size={ICON_SIZE} aria-hidden />
          {t("adminTools.translations.exportAll", { count: rows.length })}
        </Button>
        <Button type="button" $variant="primary" onClick={() => open(EMPTY_DRAFT, true)}>
          <Plus size={ICON_SIZE} aria-hidden />
          {t("adminTools.translations.add")}
        </Button>
      </Stack>

      <DataTable
        caption={t("adminTools.translations.title")}
        columns={columns}
        rows={shown}
        rowKey={(row) => row.key}
        empty={t("adminTools.translations.empty")}
        pageSize={PAGE_SIZE}
        resetKey={`${query}|${untranslatedOnly}`}
      />

      <FormDialog
        open={editing !== null}
        title={t(editing?.isNew ? "adminTools.translations.add" : "adminTools.translations.editTitle")}
        dirty={Boolean(editing?.touched)}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitLabel={t("action.save")}
        submitDisabled={!draft.key || !draft.en.trim() || !draft.he.trim() || keyError !== undefined}
        error={editing?.error ? t(editing.error) : null}
      >
        <Field label={t("adminTools.translations.key")} error={keyError} hint={editing?.isNew ? t("adminTools.issue.translationKey") : undefined}>
          {(id) => <Input id={id} dir="ltr" value={draft.key} maxLength={NAME_MAX} readOnly={!editing?.isNew} required onChange={(event) => change({ key: event.target.value })} />}
        </Field>
        <Field label={t("adminTools.translations.en")}>
          {(id) => <Textarea id={id} dir="ltr" lang="en" rows={TEXT_ROWS} maxLength={TEXT_MAX} value={draft.en} required onChange={(event) => change({ en: event.target.value })} />}
        </Field>
        <Field label={t("adminTools.translations.he")}>
          {(id) => <Textarea id={id} dir="rtl" lang="he" rows={TEXT_ROWS} maxLength={TEXT_MAX} value={draft.he} required onChange={(event) => change({ he: event.target.value })} />}
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={resetting !== null}
        title={t(resetting?.builtIn === false ? "adminTools.translations.deleteTitle" : "adminTools.translations.resetTitle")}
        confirmLabel={t(resetting?.builtIn === false ? "action.delete" : "action.reset")}
        onConfirm={confirmReset}
        onClose={() => setResetting(null)}
        danger
      >
        <Paragraph>
          {t(resetting?.builtIn === false ? "adminTools.translations.deleteConfirm" : "adminTools.translations.resetConfirm")} <Ltr>{resetting?.key}</Ltr>
        </Paragraph>
      </ConfirmDialog>
    </AdminPage>
  );
}
