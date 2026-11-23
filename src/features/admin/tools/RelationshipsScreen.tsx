"use client";

import { Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { Button, Field, Input, Ltr, Paragraph, Stack, Text, Textarea } from "@/components/ui";
import { ADMIN_AREA_MIN_ROLE } from "@/features/auth";
import { useI18n } from "@/i18n";
import { NEW_RELATIONSHIP, deleteRelationship, relationshipUsage, saveRelationship, type RelationshipDraft, type RelationshipError } from "./dataModelRules";
import { ALIAS_MAX, JOIN_TYPES, TEXT_MAX, isIdentifier, type JoinType, type Relationship } from "./model";
import { dataModelRepository } from "./repository";
import { DataTable, type Column } from "./table";
import { AdminPage, ConfirmDialog, FormDialog, ICON_SIZE, IconButton, SearchBox, SelectField, matchesQuery, useSave } from "./ui";

const JOIN_OPTIONS = JOIN_TYPES.map((type) => ({ value: type, label: type }));
const isJoinType = (value: string): value is JoinType => JOIN_TYPES.some((type) => type === value);
const ARROW = "→";

interface Editing {
  id?: number;
  draft: RelationshipDraft;
  touched: boolean;
  error: RelationshipError | null;
}

/** How two entities join. Reports reach a joined entity through the relationship's alias. */
export function RelationshipsScreen() {
  const { t } = useI18n();
  const save = useSave();
  const model = dataModelRepository.useValue();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Relationship | null>(null);
  const draft = editing?.draft ?? NEW_RELATIONSHIP;
  const keyOf = (id: number | null) => model.entities.find((entity) => entity.id === id)?.key ?? "";
  const label = (row: Relationship) => `${keyOf(row.sourceEntityId)}.${row.sourceColumn} ${ARROW} ${keyOf(row.targetEntityId)}.${row.targetColumn}`;
  const aliasError = draft.alias.trim() && !isIdentifier(draft.alias.trim(), ALIAS_MAX) ? t("adminTools.identifier") : undefined;
  const rows = model.relationships.filter((row) => matchesQuery(query, [row.id, label(row), row.joinType, row.alias, row.description]));

  // Active entities, plus the one already chosen so an older row still shows what it points at.
  const entityOptions = (chosen: number | null) => model.entities.filter((entity) => entity.isActive || entity.id === chosen).map((entity) => ({ value: String(entity.id), label: entity.key }));
  const columnOptions = (entityId: number | null) => (model.entities.find((entity) => entity.id === entityId)?.columns ?? []).map((column) => ({ value: column.name, label: `${column.name} (${column.dataType})` }));
  const change = (part: Partial<RelationshipDraft>) => setEditing((current) => current && { ...current, draft: { ...current.draft, ...part }, touched: true, error: null });

  const submit = () => {
    if (!editing) return;
    const result = saveRelationship({ model, draft, editingId: editing.id });
    if (!result.ok) return setEditing({ ...editing, error: result.error });
    if (save({ store: dataModelRepository, value: result.value, title: "adminTools.relationships.saved" })) setEditing(null);
  };

  const confirmDelete = () => {
    if (deleting) save({ store: dataModelRepository, value: deleteRelationship(model, deleting.id), title: "adminTools.relationships.deleted" });
    setDeleting(null);
  };

  const dash = (text: string | null) => (text ? <Ltr>{text}</Ltr> : <Text $muted>{t("adminTools.none")}</Text>);
  const columns: Column<Relationship>[] = [
    { key: "id", header: t("adminTools.id"), cell: (row) => <Ltr>{row.id}</Ltr> },
    { key: "source", header: t("adminTools.relationships.source"), cell: (row) => <Ltr>{keyOf(row.sourceEntityId)}</Ltr> },
    { key: "target", header: t("adminTools.relationships.target"), cell: (row) => <Ltr>{keyOf(row.targetEntityId)}</Ltr> },
    { key: "join", header: t("adminTools.relationships.joinType"), cell: (row) => <Ltr>{row.joinType}</Ltr> },
    { key: "sourceColumn", header: t("adminTools.relationships.sourceColumn"), cell: (row) => <Ltr>{row.sourceColumn}</Ltr> },
    { key: "targetColumn", header: t("adminTools.relationships.targetColumn"), cell: (row) => <Ltr>{row.targetColumn}</Ltr> },
    { key: "alias", header: t("adminTools.alias"), cell: (row) => dash(row.alias) },
    { key: "description", header: t("adminTools.description"), cell: (row) => row.description ?? <Text $muted>{t("adminTools.none")}</Text> },
    { key: "usedBy", header: t("adminTools.relationships.usedBy"), cell: (row) => <Ltr>{relationshipUsage(model, row.id)}</Ltr> },
    {
      key: "actions",
      header: t("adminTools.actions"),
      cell: (row) => (
        <Stack $row $gap="xs" $justify="end">
          <IconButton label={t("adminTools.editItem", { name: label(row) })} icon={Pencil} onClick={() => setEditing({ id: row.id, draft: { ...row, alias: row.alias ?? "", description: row.description ?? "" }, touched: false, error: null })} />
          <IconButton label={t("adminTools.deleteItem", { name: label(row) })} icon={Trash} onClick={() => setDeleting(row)} />
        </Stack>
      ),
    },
  ];

  return (
    <AdminPage min={ADMIN_AREA_MIN_ROLE} title={t("adminTools.relationships.title")} description={t("adminTools.relationships.desc")}>
      <Stack $row $wrap $gap="sm">
        <SearchBox value={query} onChange={setQuery} label={t("adminTools.relationships.search")} />
        <Button type="button" $variant="primary" disabled={!model.entities.some((entity) => entity.isActive)} onClick={() => setEditing({ draft: NEW_RELATIONSHIP, touched: false, error: null })}>
          <Plus size={ICON_SIZE} aria-hidden />
          {t("adminTools.relationships.add")}
        </Button>
      </Stack>
      <DataTable caption={t("adminTools.relationships.title")} columns={columns} rows={rows} rowKey={(row) => row.id} empty={t("adminTools.noRows")} resetKey={query} />

      <FormDialog
        open={editing !== null}
        title={t(editing?.id === undefined ? "adminTools.relationships.add" : "adminTools.relationships.edit")}
        dirty={Boolean(editing?.touched)}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitLabel={t("action.save")}
        submitDisabled={aliasError !== undefined}
        error={editing?.error ? t(`adminTools.relationships.error.${editing.error}`) : null}
      >
        <SelectField
          label={t("adminTools.relationships.source")}
          value={String(draft.sourceEntityId ?? "")}
          onChange={(value) => change({ sourceEntityId: Number(value) || null, sourceColumn: "" })}
          options={entityOptions(draft.sourceEntityId)}
          placeholder={t("adminTools.choose")}
        />
        <SelectField label={t("adminTools.relationships.sourceColumn")} value={draft.sourceColumn} onChange={(sourceColumn) => change({ sourceColumn })} options={columnOptions(draft.sourceEntityId)} placeholder={t("adminTools.choose")} />
        <SelectField
          label={t("adminTools.relationships.target")}
          value={String(draft.targetEntityId ?? "")}
          onChange={(value) => change({ targetEntityId: Number(value) || null, targetColumn: "" })}
          options={entityOptions(draft.targetEntityId)}
          placeholder={t("adminTools.choose")}
        />
        <SelectField label={t("adminTools.relationships.targetColumn")} value={draft.targetColumn} onChange={(targetColumn) => change({ targetColumn })} options={columnOptions(draft.targetEntityId)} placeholder={t("adminTools.choose")} />
        <SelectField label={t("adminTools.relationships.joinType")} value={draft.joinType} onChange={(value) => isJoinType(value) && change({ joinType: value })} options={JOIN_OPTIONS} />
        <Field label={t("adminTools.alias")} error={aliasError} hint={t("adminTools.relationships.aliasHint")}>
          {(id) => <Input id={id} dir="ltr" value={draft.alias} maxLength={ALIAS_MAX} onChange={(event) => change({ alias: event.target.value })} />}
        </Field>
        <Field label={t("adminTools.description")}>
          {(id) => <Textarea id={id} value={draft.description ?? ""} maxLength={TEXT_MAX} onChange={(event) => change({ description: event.target.value })} />}
        </Field>
      </FormDialog>

      <ConfirmDialog open={deleting !== null} title={t("adminTools.relationships.deleteTitle")} confirmLabel={t("action.delete")} onConfirm={confirmDelete} onClose={() => setDeleting(null)} danger>
        <Paragraph>
          {t("adminTools.relationships.deleteConfirm", { count: deleting ? relationshipUsage(model, deleting.id) : 0 })} <Ltr>{deleting ? label(deleting) : ""}</Ltr>
        </Paragraph>
      </ConfirmDialog>
    </AdminPage>
  );
}
