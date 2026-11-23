"use client";

import { REPORTS } from "@/data/reports";
import { createLocalStore } from "@/lib/store";
import { DEFAULT_JOIN_TYPE, dataModelSchema, type DataModel, type Entity, type EntityColumn, type Relationship, type ReportEntity } from "./model";

// shortcut: there is no database yet, so the admin data model lives in this browser (see lib/store.ts).
// Upgrade: back `dataModelRepository` with the /api/admin routes; the screens and the import only use this module.

/** The tables an entity can be registered on: today the six datasets, all in the `source` database. */
export function tableColumns(tableName: string): EntityColumn[] | null {
  const report = REPORTS.find((item) => item.id === tableName);
  return report ? report.fields.map((field) => ({ name: field.key, dataType: field.type })) : null;
}

const seedEntities: Entity[] = REPORTS.map((report, index) => ({
  id: index + 1,
  key: report.id,
  sourceDatabase: "source",
  tableName: report.id,
  entityType: "table",
  description: null,
  isActive: true,
  columns: tableColumns(report.id) ?? [],
}));

// The natural links between the datasets: [source, source column, target, target column, alias].
const SEED_LINKS = [
  ["orders", "customer", "customers", "name", "customer"],
  ["invoices", "orderId", "orders", "orderId", "order"],
  ["shipments", "orderId", "orders", "orderId", "order"],
  ["tickets", "customer", "customers", "name", "customer"],
] as const;

const entityId = (key: string): number => seedEntities.findIndex((entity) => entity.key === key) + 1;

const seedRelationships: Relationship[] = SEED_LINKS.map(([source, sourceColumn, target, targetColumn, alias], index) => ({
  id: index + 1,
  sourceEntityId: entityId(source),
  targetEntityId: entityId(target),
  joinType: DEFAULT_JOIN_TYPE,
  sourceColumn,
  targetColumn,
  alias,
  description: null,
}));

// Every report starts from its own dataset; reports with a link also get the joined entity under the link's alias.
const seedReportEntities: ReportEntity[] = [
  ...seedEntities.map((entity) => ({ id: entity.id, reportId: entity.key, entityId: entity.id, relationshipId: null, alias: null, isBaseEntity: true, order: 0 })),
  ...seedRelationships.map((link, index) => ({
    id: seedEntities.length + index + 1,
    reportId: seedEntities[link.sourceEntityId - 1].key,
    entityId: link.targetEntityId,
    relationshipId: link.id,
    alias: link.alias,
    isBaseEntity: false,
    order: 1,
  })),
];

export const SEED_DATA_MODEL: DataModel = {
  entities: seedEntities,
  relationships: seedRelationships,
  reportEntities: seedReportEntities,
  fields: {},
};

const store = createLocalStore<DataModel>("bahir_admin_data_model", dataModelSchema, SEED_DATA_MODEL);

export const dataModelRepository = {
  read: store.read,
  write: store.write,
  /** React hook: the current data model, re-rendering on change (also from other tabs). */
  useValue: store.useValue,
};
