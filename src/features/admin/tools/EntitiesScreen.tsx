"use client";

import { Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Checkbox, Field, Input, Ltr, Notice, Paragraph, Stack, Text, Textarea, useToast } from "@/components/ui";
import { REPORTS } from "@/data/reports";
import { ADMIN_AREA_MIN_ROLE } from "@/features/auth";
import { useI18n } from "@/i18n";
import { NEW_ENTITY, deleteEntity, entityUsage, saveEntity, type EntityDraft, type EntityError } from "./dataModelRules";
import { ENTITY_TYPES, NAME_MAX, TEXT_MAX, isIdentifier, type Entity, type EntityType } from "./model";
import { dataModelRepository } from "./repository";
import { DataTable, type Column } from "./table";
import { AdminPage, ConfirmDialog, FormDialog, ICON_SIZE, IconButton, SearchBox, SelectField, matchesQuery, useSave } from "./ui";

const TABLE_OPTIONS = REPORTS.map((report) => ({ value: report.id, label: report.id }));
const isEntityType = (value: string): value is EntityType => ENTITY_TYPES.some((type) => type === value);

interface Editing {
  id?: number;
  draft: EntityDraft;
  touched: boolean;
  error: EntityError | null;
}

/** The tables and views reports read from. An entity's key and table are fixed once it exists. */
export function EntitiesScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const save = useSave();
  const model = dataModelRepository.useValue();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Entity | null>(null);
  const draft = editing?.draft ?? NEW_ENTITY;
  const isNew = editing?.id === undefined;
  const keyError = isNew && draft.key && !isIdentifier(draft.key.trim()) ? t("adminTools.identifier") : undefined;
  const rows = model.entities.filter((row) => matchesQuery(query, [row.id, row.key, row.tableName, row.description]));
  const usage = deleting ? entityUsage(model, deleting.id) : null;

  const change = (part: Partial<EntityDraft>) => setEditing((current) => current && { ...current, draft: { ...current.draft, ...part }, touched: true, error: null });

  const submit = () => {
    if (!editing) return;
    const result = saveEntity({ model, draft, editingId: editing.id });
    if (!result.ok) return setEditing({ ...editing, error: result.error });
    if (save({ store: dataModelRepository, value: result.value, title: "adminTools.entities.saved", titleVars: { key: draft.key.trim() } })) setEditing(null);
  };

  // Asked before the confirmation opens, and again when it is confirmed: the model may have changed in between.
  const remove = (row: Entity, confirmed: boolean) => {
    const result = deleteEntity(model, row.id);
    if (!result.ok) toast.error({ title: `adminTools.entities.error.${result.error}`, titleVars: { key: row.key } });
    else if (confirmed) save({ store: dataModelRepository, value: result.value, title: "adminTools.entities.deleted", titleVars: { key: row.key } });
    setDeleting(result.ok && !confirmed ? row : null);
  };

  const columns: Column<Entity>[] = [
    { key: "id", header: t("adminTools.id"), cell: (row) => <Ltr>{row.id}</Ltr> },
    { key: "key", header: t("adminTools.entities.key"), cell: (row) => <Ltr>{row.key}</Ltr> },
    { key: "table", header: t("adminTools.entities.table"), cell: (row) => <Ltr>{row.tableName}</Ltr> },
    { key: "type", header: t("adminTools.entities.type"), cell: (row) => t(`adminTools.entities.type.${row.entityType}`) },
    { key: "columns", header: t("adminTools.entities.columns"), cell: (row) => <Ltr>{row.columns.length}</Ltr> },
    {
      key: "status",
      header: t("adminTools.entities.status"),
      cell: (row) => <Badge $tone={row.isActive ? "success" : "neutral"}>{t(row.isActive ? "adminTools.entities.active" : "adminTools.entities.inactive")}</Badge>,
    },
    { key: "description", header: t("adminTools.description"), cell: (row) => row.description ?? <Text $muted>{t("adminTools.none")}</Text> },
    {
      key: "actions",
      header: t("adminTools.actions"),
      cell: (row) => (
        <Stack $row $gap="xs" $justify="end">
          <IconButton label={t("adminTools.editItem", { name: row.key })} icon={Pencil} onClick={() => setEditing({ id: row.id, draft: { ...row, description: row.description ?? "" }, touched: false, error: null })} />
          <IconButton label={t("adminTools.deleteItem", { name: row.key })} icon={Trash} onClick={() => remove(row, false)} />
        </Stack>
      ),
    },
  ];

  return (
    <AdminPage min={ADMIN_AREA_MIN_ROLE} title={t("adminTools.entities.title")} description={t("adminTools.entities.desc")}>
      <Notice $tone="info" role="note">
        {t("adminTools.entities.info")}
      </Notice>
      <Stack $row $wrap $gap="sm">
        <SearchBox value={query} onChange={setQuery} label={t("adminTools.entities.search")} />
        <Button type="button" $variant="primary" onClick={() => setEditing({ draft: NEW_ENTITY, touched: false, error: null })}>
          <Plus size={ICON_SIZE} aria-hidden />
          {t("adminTools.entities.add")}
        </Button>
      </Stack>
      <DataTable caption={t("adminTools.entities.title")} columns={columns} rows={rows} rowKey={(row) => row.id} empty={t("adminTools.noRows")} resetKey={query} />

      <FormDialog
        open={editing !== null}
        title={t(isNew ? "adminTools.entities.add" : "adminTools.entities.edit")}
        dirty={Boolean(editing?.touched)}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitLabel={t("action.save")}
        submitDisabled={isNew && (!draft.key.trim() || !draft.tableName || keyError !== undefined)}
        error={editing?.error ? t(`adminTools.entities.error.${editing.error}`, { key: draft.key.trim() }) : null}
      >
        <SelectField label={t("adminTools.entities.table")} value={draft.tableName} onChange={(tableName) => change({ tableName })} options={TABLE_OPTIONS} placeholder={t("adminTools.choose")} disabled={!isNew} />
        <Field label={t("adminTools.entities.key")} error={keyError} hint={isNew ? t("adminTools.identifier") : t("adminTools.entities.fixed")}>
          {(id) => <Input id={id} dir="ltr" value={draft.key} maxLength={NAME_MAX} readOnly={!isNew} required onChange={(event) => change({ key: event.target.value })} />}
        </Field>
        <SelectField
          label={t("adminTools.entities.type")}
          value={draft.entityType}
          onChange={(value) => isEntityType(value) && change({ entityType: value })}
          options={ENTITY_TYPES.map((type) => ({ value: type, label: t(`adminTools.entities.type.${type}`) }))}
        />
        <Field label={t("adminTools.description")}>
          {(id) => <Textarea id={id} value={draft.description} maxLength={TEXT_MAX} onChange={(event) => change({ description: event.target.value })} />}
        </Field>
        <Checkbox checked={draft.isActive} onChange={(isActive) => change({ isActive })}>
          {t("adminTools.entities.activeHint")}
        </Checkbox>
      </FormDialog>

      <ConfirmDialog open={deleting !== null} title={t("adminTools.entities.deleteTitle")} confirmLabel={t("action.delete")} onConfirm={() => deleting && remove(deleting, true)} onClose={() => setDeleting(null)} danger>
        <Paragraph>
          {t("adminTools.entities.deleteConfirm", { relationships: usage?.relationships ?? 0, links: usage?.reportEntities ?? 0, fields: usage?.fields ?? 0 })} <Ltr>{deleting?.key}</Ltr>
        </Paragraph>
      </ConfirmDialog>
    </AdminPage>
  );
}
