import { REPORTS } from "@/data/reports";
import {
  ALIAS_MAX,
  DEFAULT_JOIN_TYPE,
  isIdentifier,
  nextId,
  type DataModel,
  type Entity,
  type EntityType,
  type JoinType,
  type Relationship,
  type ReportEntity,
  type Result,
} from "./model";
import { tableColumns } from "./repository";

// The rules behind the entities, relationships and report-entities screens. Pure: a model in, a model or a reason out.
// shortcut: checked in the browser only, because the model is stored there; the /api/admin routes repeat every rule.

const DEFAULT_SOURCE = "source";

/** Blank becomes "no alias". Undefined: not a safe identifier. */
function cleanAlias(text: string): string | null | undefined {
  const alias = text.trim();
  if (!alias) return null;
  return isIdentifier(alias, ALIAS_MAX) ? alias : undefined;
}

export interface EntityDraft {
  key: string;
  tableName: string;
  entityType: EntityType;
  description: string;
  isActive: boolean;
}
export const NEW_ENTITY: EntityDraft = { key: "", tableName: "", entityType: "table", description: "", isActive: true };
export type EntityError = "identifier" | "duplicateKey" | "unknownTable";

interface SaveInput<T> {
  model: DataModel;
  draft: T;
  /** The row being edited. Absent: a new row. */
  editingId?: number;
}

/** A new entity needs a safe, unused key and a table that exists. An existing one keeps its key, table and columns. */
export function saveEntity({ model, draft, editingId }: SaveInput<EntityDraft>): Result<DataModel, EntityError> {
  const changes = { entityType: draft.entityType, description: draft.description.trim() || null, isActive: draft.isActive };
  if (editingId !== undefined) {
    return { ok: true, value: { ...model, entities: model.entities.map((entity) => (entity.id === editingId ? { ...entity, ...changes } : entity)) } };
  }
  const key = draft.key.trim();
  if (!isIdentifier(key) || !isIdentifier(draft.tableName)) return { ok: false, error: "identifier" };
  if (model.entities.some((entity) => entity.key === key)) return { ok: false, error: "duplicateKey" };
  const columns = tableColumns(draft.tableName);
  if (!columns) return { ok: false, error: "unknownTable" };
  const entity: Entity = { id: nextId(model.entities), key, sourceDatabase: DEFAULT_SOURCE, tableName: draft.tableName, columns, ...changes };
  return { ok: true, value: { ...model, entities: [...model.entities, entity] } };
}

/** What deleting an entity takes with it, for the confirmation. */
export function entityUsage(model: DataModel, id: number) {
  const key = model.entities.find((entity) => entity.id === id)?.key;
  return {
    relationships: model.relationships.filter((row) => row.sourceEntityId === id || row.targetEntityId === id).length,
    reportEntities: model.reportEntities.filter((row) => row.entityId === id).length,
    fields: Object.values(model.fields).flat().filter((field) => field.entityKey === key).length,
  };
}

/** Removes the entity with its relationships, report links and imported fields. Refused while a report starts from it. */
export function deleteEntity(model: DataModel, id: number): Result<DataModel, "isBase"> {
  if (model.reportEntities.some((row) => row.entityId === id && row.isBaseEntity)) return { ok: false, error: "isBase" };
  const key = model.entities.find((entity) => entity.id === id)?.key;
  const relationships = model.relationships.filter((row) => row.sourceEntityId !== id && row.targetEntityId !== id);
  const kept = new Set(relationships.map((row) => row.id));
  return {
    ok: true,
    value: {
      entities: model.entities.filter((entity) => entity.id !== id),
      relationships,
      reportEntities: model.reportEntities.filter((row) => row.entityId !== id).map((row) => (row.relationshipId === null || kept.has(row.relationshipId) ? row : { ...row, relationshipId: null })),
      fields: Object.fromEntries(Object.entries(model.fields).map(([reportId, fields]) => [reportId, fields.filter((field) => field.entityKey !== key)])),
    },
  };
}

export interface RelationshipDraft {
  sourceEntityId: number | null;
  targetEntityId: number | null;
  joinType: JoinType;
  sourceColumn: string;
  targetColumn: string;
  alias: string;
  description: string | null;
}
export const NEW_RELATIONSHIP: RelationshipDraft = { sourceEntityId: null, targetEntityId: null, joinType: DEFAULT_JOIN_TYPE, sourceColumn: "", targetColumn: "", alias: "", description: "" };
export type RelationshipError = "required" | "sameEntity" | "inactive" | "unknownColumn" | "identifier" | "duplicate" | "aliasRequired" | "aliasTaken";

/** The six rules of the relationship form, in order; the first one that fails is the answer. */
export function saveRelationship({ model, draft, editingId }: SaveInput<RelationshipDraft>): Result<DataModel, RelationshipError> {
  const { sourceEntityId, targetEntityId, joinType, sourceColumn, targetColumn } = draft;
  if (sourceEntityId === null || targetEntityId === null || !sourceColumn || !targetColumn) return { ok: false, error: "required" };
  if (sourceEntityId === targetEntityId) return { ok: false, error: "sameEntity" };
  const source = model.entities.find((entity) => entity.id === sourceEntityId && entity.isActive);
  const target = model.entities.find((entity) => entity.id === targetEntityId && entity.isActive);
  if (!source || !target) return { ok: false, error: "inactive" };
  const has = (entity: Entity, name: string) => entity.columns.some((column) => column.name === name);
  if (!has(source, sourceColumn) || !has(target, targetColumn)) return { ok: false, error: "unknownColumn" };
  const alias = cleanAlias(draft.alias);
  if (alias === undefined) return { ok: false, error: "identifier" };

  const onPair = model.relationships.filter((row) => row.id !== editingId && row.sourceEntityId === sourceEntityId && row.targetEntityId === targetEntityId);
  if (onPair.some((row) => row.joinType === joinType && row.sourceColumn === sourceColumn && row.targetColumn === targetColumn && row.alias === alias)) return { ok: false, error: "duplicate" };
  if (onPair.length > 0 && alias === null) return { ok: false, error: "aliasRequired" };
  if (onPair.some((row) => row.alias === alias)) return { ok: false, error: "aliasTaken" };

  const row: Relationship = { id: editingId ?? nextId(model.relationships), sourceEntityId, targetEntityId, joinType, sourceColumn, targetColumn, alias, description: draft.description?.trim() || null };
  const relationships = editingId === undefined ? [...model.relationships, row] : model.relationships.map((other) => (other.id === editingId ? row : other));
  return { ok: true, value: { ...model, relationships } };
}

/** How many report links join through the relationship, for the confirmation. */
export const relationshipUsage = (model: DataModel, id: number): number => model.reportEntities.filter((row) => row.relationshipId === id).length;

/** Removes the join. Report links that used it stay, without it. */
export function deleteRelationship(model: DataModel, id: number): DataModel {
  return {
    ...model,
    relationships: model.relationships.filter((row) => row.id !== id),
    reportEntities: model.reportEntities.map((row) => (row.relationshipId === id ? { ...row, relationshipId: null } : row)),
  };
}

export interface ReportEntityDraft {
  reportId: string;
  entityId: number | null;
  alias: string;
  isBaseEntity: boolean;
  order: number;
}
export type ReportEntityError = "required" | "unknownReport" | "inactive" | "identifier" | "order" | "duplicate" | "aliasTaken" | "noBase";

/** The order a new link gets: after the report's last one, 0 for the first. */
export function nextOrder(model: DataModel, reportId: string): number {
  const orders = model.reportEntities.filter((row) => row.reportId === reportId).map((row) => row.order);
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}

/** Links an entity to a report, or edits a link's alias, base flag and order. A report always ends with exactly one base. */
export function saveReportEntity({ model, draft, editingId }: SaveInput<ReportEntityDraft>): Result<DataModel, ReportEntityError> {
  const existing = model.reportEntities.find((row) => row.id === editingId);
  const reportId = existing?.reportId ?? draft.reportId;
  const entityId = existing?.entityId ?? draft.entityId;
  if (entityId === null || !reportId) return { ok: false, error: "required" };
  if (!REPORTS.some((report) => report.id === reportId)) return { ok: false, error: "unknownReport" };
  // Only a new link needs an active entity: reports that already use an inactive one keep working.
  if (!existing && !model.entities.some((entity) => entity.id === entityId && entity.isActive)) return { ok: false, error: "inactive" };
  const alias = cleanAlias(draft.alias);
  if (alias === undefined) return { ok: false, error: "identifier" };
  if (!Number.isInteger(draft.order) || draft.order < 0) return { ok: false, error: "order" };

  const others = model.reportEntities.filter((row) => row.reportId === reportId && row.id !== editingId);
  if (others.some((row) => row.entityId === entityId && row.alias === alias)) return { ok: false, error: "duplicate" };
  if (alias !== null && others.some((row) => row.alias === alias)) return { ok: false, error: "aliasTaken" };
  if (!draft.isBaseEntity && !others.some((row) => row.isBaseEntity)) return { ok: false, error: "noBase" };

  const joinedBy = model.relationships.find((row) => row.targetEntityId === entityId && row.alias !== null && row.alias === alias);
  const row: ReportEntity = { id: existing?.id ?? nextId(model.reportEntities), reportId, entityId, relationshipId: joinedBy?.id ?? null, alias, isBaseEntity: draft.isBaseEntity, order: draft.order };
  // Marking this row as the base un-marks the report's other rows.
  const settle = (other: ReportEntity): ReportEntity => (other.id === row.id ? row : draft.isBaseEntity && other.reportId === reportId ? { ...other, isBaseEntity: false } : other);
  return { ok: true, value: { ...model, reportEntities: (existing ? model.reportEntities : [...model.reportEntities, row]).map(settle) } };
}

/** Removes a link. Refused for the base row and for a row that imported fields still read through. */
export function deleteReportEntity(model: DataModel, id: number): Result<DataModel, "isBase" | "fieldsInUse"> {
  const row = model.reportEntities.find((other) => other.id === id);
  if (!row) return { ok: true, value: model };
  if (row.isBaseEntity) return { ok: false, error: "isBase" };
  const key = model.entities.find((entity) => entity.id === row.entityId)?.key;
  const linkedAgain = model.reportEntities.some((other) => other.id !== id && other.reportId === row.reportId && other.entityId === row.entityId);
  if (!linkedAgain && (model.fields[row.reportId] ?? []).some((field) => field.entityKey === key)) return { ok: false, error: "fieldsInUse" };
  return { ok: true, value: { ...model, reportEntities: model.reportEntities.filter((other) => other.id !== id) } };
}
