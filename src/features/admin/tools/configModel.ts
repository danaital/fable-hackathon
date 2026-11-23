import { REPORTS } from "@/data/reports";
import { BUILT_IN_MESSAGES } from "@/i18n";
import { stableStringify, type ReportConfig } from "./configImport";
import { nextId, type DataModel, type PortableField, type PortableRelationship, type PortableReportEntity, type Relationship, type ReportEntity } from "./model";

// Between the stored data model (numeric ids) and the portable sections of a report's JSON (keys only).

type ModelSections = Pick<ReportConfig, "reportEntities" | "entityRelationships" | "fields">;

/** The fields a report has in code, in portable form. Each dataset is its own entity and each field its own column. */
export function builtInFields(reportId: string): PortableField[] {
  const report = REPORTS.find((item) => item.id === reportId);
  return (report?.fields ?? []).map((field) => ({
    key: field.key,
    entityKey: reportId,
    columnName: field.key,
    fieldType: field.type,
    label: { en: BUILT_IN_MESSAGES.en[field.labelKey], he: BUILT_IN_MESSAGES.he[field.labelKey] },
  }));
}

/** Built-in fields with the imported definitions laid over them by key. */
export function reportFields(model: DataModel, reportId: string): PortableField[] {
  const fields = builtInFields(reportId);
  for (const stored of model.fields[reportId] ?? []) {
    const position = fields.findIndex((field) => field.key === stored.key);
    if (position < 0) fields.push(stored);
    else fields[position] = stored;
  }
  return fields;
}

/** A report's entity links, the relationships between the entities it uses, and its fields. No ids. */
export function modelSections(model: DataModel, reportId: string): ModelSections {
  const keyOf = new Map(model.entities.map((entity) => [entity.id, entity.key]));
  const links = model.reportEntities.filter((row) => row.reportId === reportId).sort((a, b) => a.order - b.order);
  const used = new Set(links.map((row) => row.entityId));
  const reportEntities = links.flatMap((row): PortableReportEntity[] => {
    const entityKey = keyOf.get(row.entityId);
    return entityKey ? [{ entityKey, alias: row.alias, isBaseEntity: row.isBaseEntity, order: row.order }] : [];
  });
  const entityRelationships = model.relationships.flatMap((row): PortableRelationship[] => {
    const sourceEntityKey = keyOf.get(row.sourceEntityId);
    const targetEntityKey = keyOf.get(row.targetEntityId);
    if (!sourceEntityKey || !targetEntityKey || !used.has(row.sourceEntityId) || !used.has(row.targetEntityId)) return [];
    const { joinType, sourceColumn, targetColumn, alias, description } = row;
    return [{ sourceEntityKey, targetEntityKey, joinType, sourceColumn, targetColumn, alias, description }];
  });
  return { reportEntities, entityRelationships, fields: reportFields(model, reportId) };
}

interface MergeInput {
  model: DataModel;
  reportId: string;
  next: ModelSections;
}

/** Writes checked sections back into the data model: matching rows keep their id, new ones get the next id, nothing is removed. */
export function mergeSections({ model, reportId, next }: MergeInput): DataModel {
  const idOf = new Map(model.entities.map((entity) => [entity.key, entity.id]));

  const relationships = [...model.relationships];
  for (const { sourceEntityKey, targetEntityKey, ...join } of next.entityRelationships) {
    const sourceEntityId = idOf.get(sourceEntityKey);
    const targetEntityId = idOf.get(targetEntityKey);
    if (sourceEntityId === undefined || targetEntityId === undefined) continue;
    const position = relationships.findIndex(
      (row) => row.sourceEntityId === sourceEntityId && row.targetEntityId === targetEntityId && row.alias === join.alias,
    );
    const row: Relationship = { id: position < 0 ? nextId(relationships) : relationships[position].id, sourceEntityId, targetEntityId, ...join };
    if (position < 0) relationships.push(row);
    else relationships[position] = row;
  }

  const reportEntities = [...model.reportEntities];
  for (const { entityKey, ...link } of next.reportEntities) {
    const entityId = idOf.get(entityKey);
    if (entityId === undefined) continue;
    const position = reportEntities.findIndex((row) => row.reportId === reportId && row.entityId === entityId && row.alias === link.alias);
    const joinedBy = relationships.find((row) => row.targetEntityId === entityId && row.alias !== null && row.alias === link.alias);
    const row: ReportEntity =
      position < 0
        ? { id: nextId(reportEntities), reportId, entityId, relationshipId: joinedBy?.id ?? null, ...link }
        : { ...reportEntities[position], ...link };
    if (position < 0) reportEntities.push(row);
    else reportEntities[position] = row;
  }

  // Only what differs from the fields in code is stored, so built-in fields keep following the code.
  const builtIn = new Map(builtInFields(reportId).map((field) => [field.key, stableStringify(field)]));
  const fields = next.fields.filter((field) => builtIn.get(field.key) !== stableStringify(field));
  return { ...model, relationships, reportEntities, fields: { ...model.fields, [reportId]: fields } };
}
