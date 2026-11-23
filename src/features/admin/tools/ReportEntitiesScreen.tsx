"use client";

import { Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Checkbox, Field, Input, Ltr, Paragraph, Stack, Text, useToast } from "@/components/ui";
import { REPORTS } from "@/data/reports";
import { ADMIN_AREA_MIN_ROLE } from "@/features/auth";
import { useI18n } from "@/i18n";
import { deleteReportEntity, nextOrder, saveReportEntity, type ReportEntityDraft, type ReportEntityError } from "./dataModelRules";
import { ALIAS_MAX, isIdentifier, type ReportEntity } from "./model";
import { dataModelRepository } from "./repository";
import { DataTable, type Column } from "./table";
import { AdminPage, ConfirmDialog, FormDialog, ICON_SIZE, IconButton, SearchBox, SelectField, matchesQuery, useSave } from "./ui";

/** The order is kept as typed text so an empty box is not read as 0. */
type Draft = Omit<ReportEntityDraft, "order"> & { order: string };
const NEW_LINK: Draft = { reportId: "", entityId: null, alias: "", isBaseEntity: false, order: "0" };

interface Editing {
  id?: number;
  draft: Draft;
  touched: boolean;
  error: ReportEntityError | null;
}

/** Which entities each report uses, under which alias, and which one it starts from. */
export function ReportEntitiesScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const save = useSave();
  const model = dataModelRepository.useValue();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<ReportEntity | null>(null);
  const draft = editing?.draft ?? NEW_LINK;
  const isNew = editing?.id === undefined;
  const keyOf = (id: number | null) => model.entities.find((entity) => entity.id === id)?.key ?? "";
  const reportTitle = (id: string) => {
    const report = REPORTS.find((item) => item.id === id);
    return report ? t(report.titleKey) : id;
  };
  const name = (row: ReportEntity) => `${row.reportId}: ${keyOf(row.entityId)}${row.alias ? ` (${row.alias})` : ""}`;
  const aliasError = draft.alias.trim() && !isIdentifier(draft.alias.trim(), ALIAS_MAX) ? t("adminTools.identifier") : undefined;
  const rows = model.reportEntities.filter((row) => matchesQuery(query, [row.id, row.reportId, reportTitle(row.reportId), keyOf(row.entityId), row.alias, row.order]));
  const entityOptions = model.entities.filter((entity) => entity.isActive || entity.id === draft.entityId).map((entity) => ({ value: String(entity.id), label: entity.key }));

  const change = (part: Partial<Draft>) => setEditing((current) => current && { ...current, draft: { ...current.draft, ...part }, touched: true, error: null });

  const submit = () => {
    if (!editing) return;
    const order = draft.order.trim() === "" ? Number.NaN : Number(draft.order);
    const result = saveReportEntity({ model, draft: { ...draft, order }, editingId: editing.id });
    if (!result.ok) return setEditing({ ...editing, error: result.error });
    // Moving the base changes the table every query of the report starts from, so it is asked first.
    const movesBase = draft.isBaseEntity && model.reportEntities.some((row) => row.reportId === draft.reportId && row.isBaseEntity && row.id !== editing.id);
    if (movesBase && !window.confirm(t("adminTools.reportEntities.confirmBase"))) return;
    if (save({ store: dataModelRepository, value: result.value, title: "adminTools.reportEntities.saved" })) setEditing(null);
  };

  // Asked before the confirmation opens, and again when it is confirmed: the model may have changed in between.
  const remove = (row: ReportEntity, confirmed: boolean) => {
    const result = deleteReportEntity(model, row.id);
    if (!result.ok) toast.error({ title: `adminTools.reportEntities.error.${result.error}` });
    else if (confirmed) save({ store: dataModelRepository, value: result.value, title: "adminTools.reportEntities.deleted" });
    setDeleting(result.ok && !confirmed ? row : null);
  };

  const columns: Column<ReportEntity>[] = [
    { key: "id", header: t("adminTools.id"), cell: (row) => <Ltr>{row.id}</Ltr> },
    {
      key: "report",
      header: t("adminTools.report"),
      cell: (row) => (
        <Text>
          {reportTitle(row.reportId)} <Ltr>({row.reportId})</Ltr>
        </Text>
      ),
    },
    { key: "entity", header: t("adminTools.reportEntities.entity"), cell: (row) => <Ltr>{keyOf(row.entityId)}</Ltr> },
    { key: "alias", header: t("adminTools.alias"), cell: (row) => (row.alias ? <Ltr>{row.alias}</Ltr> : <Text $muted>{t("adminTools.none")}</Text>) },
    {
      key: "base",
      header: t("adminTools.reportEntities.base"),
      cell: (row) => (row.isBaseEntity ? <Badge $tone="success">{t("adminTools.reportEntities.isBase")}</Badge> : <Text $muted>{t("adminTools.reportEntities.joined")}</Text>),
    },
    { key: "order", header: t("adminTools.reportEntities.order"), cell: (row) => <Ltr>{row.order}</Ltr> },
    {
      key: "actions",
      header: t("adminTools.actions"),
      cell: (row) => (
        <Stack $row $gap="xs" $justify="end">
          <IconButton label={t("adminTools.editItem", { name: name(row) })} icon={Pencil} onClick={() => setEditing({ id: row.id, draft: { ...row, alias: row.alias ?? "", order: String(row.order) }, touched: false, error: null })} />
          <IconButton label={t("adminTools.deleteItem", { name: name(row) })} icon={Trash} onClick={() => remove(row, false)} />
        </Stack>
      ),
    },
  ];

  return (
    <AdminPage min={ADMIN_AREA_MIN_ROLE} title={t("adminTools.reportEntities.title")} description={t("adminTools.reportEntities.desc")}>
      <Stack $row $wrap $gap="sm">
        <SearchBox value={query} onChange={setQuery} label={t("adminTools.reportEntities.search")} />
        <Button type="button" $variant="primary" disabled={!model.entities.some((entity) => entity.isActive)} onClick={() => setEditing({ draft: NEW_LINK, touched: false, error: null })}>
          <Plus size={ICON_SIZE} aria-hidden />
          {t("adminTools.reportEntities.add")}
        </Button>
      </Stack>
      <DataTable caption={t("adminTools.reportEntities.title")} columns={columns} rows={rows} rowKey={(row) => row.id} empty={t("adminTools.noRows")} resetKey={query} />

      <FormDialog
        open={editing !== null}
        title={t(isNew ? "adminTools.reportEntities.add" : "adminTools.reportEntities.edit")}
        dirty={Boolean(editing?.touched)}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitLabel={t("action.save")}
        submitDisabled={aliasError !== undefined}
        error={editing?.error ? t(`adminTools.reportEntities.error.${editing.error}`) : null}
      >
        <SelectField
          label={t("adminTools.report")}
          value={draft.reportId}
          onChange={(reportId) => change({ reportId, order: String(nextOrder(model, reportId)) })}
          options={REPORTS.map((report) => ({ value: report.id, label: t(report.titleKey) }))}
          placeholder={t("adminTools.choose")}
          disabled={!isNew}
        />
        <SelectField
          label={t("adminTools.reportEntities.entity")}
          value={String(draft.entityId ?? "")}
          onChange={(value) => change({ entityId: Number(value) || null })}
          options={entityOptions}
          placeholder={t("adminTools.choose")}
          disabled={!isNew}
        />
        <Field label={t("adminTools.alias")} error={aliasError} hint={t("adminTools.reportEntities.aliasHint")}>
          {(id) => <Input id={id} dir="ltr" value={draft.alias} maxLength={ALIAS_MAX} onChange={(event) => change({ alias: event.target.value })} />}
        </Field>
        <Field label={t("adminTools.reportEntities.order")}>{(id) => <Input id={id} type="number" min={0} step={1} value={draft.order} onChange={(event) => change({ order: event.target.value })} />}</Field>
        <Checkbox checked={draft.isBaseEntity} onChange={(isBaseEntity) => change({ isBaseEntity })}>
          {t("adminTools.reportEntities.baseHint")}
        </Checkbox>
      </FormDialog>

      <ConfirmDialog open={deleting !== null} title={t("adminTools.reportEntities.deleteTitle")} confirmLabel={t("action.delete")} onConfirm={() => deleting && remove(deleting, true)} onClose={() => setDeleting(null)} danger>
        <Paragraph>
          {t("adminTools.reportEntities.deleteConfirm")} <Ltr>{deleting ? name(deleting) : ""}</Ltr>
        </Paragraph>
      </ConfirmDialog>
    </AdminPage>
  );
}
