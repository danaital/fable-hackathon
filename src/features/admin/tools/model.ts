import { z } from "zod";
import { FIELD_TYPES } from "@/data/types";
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH, storedStateSchema } from "@/features/views/model";

// The admin data model: what is stored, and the id-free "portable" shapes used in JSON files.
// Every object is strict (unknown properties are refused) and every string has a length limit.

export const NAME_MAX = 255;
export const ALIAS_MAX = 100;
export const TEXT_MAX = 5000;
export const SOURCE_DATABASES = ["source", "app"] as const;
export const ENTITY_TYPES = ["table", "view"] as const;
export const JOIN_TYPES = ["INNER", "LEFT", "RIGHT", "FULL"] as const;
export type SourceDatabase = (typeof SOURCE_DATABASES)[number];
export type EntityType = (typeof ENTITY_TYPES)[number];
export type JoinType = (typeof JOIN_TYPES)[number];
export const DEFAULT_JOIN_TYPE: JoinType = "LEFT";
/** Fixed per source by configuration; never typed by the admin. */
export const SCHEMA_NAMES: Record<SourceDatabase, string> = { source: "sales", app: "bahir" };

/**
 * Keys, table names, column names and aliases end up as identifiers in generated queries once the database is
 * connected, so one strict pattern covers all of them: letters, digits and underscores, starting with a letter or
 * underscore. Forms and JSON import both use it; values that name a dataset or a column are also checked against the list.
 */
export const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const identifierSchema = z.string().min(1).max(NAME_MAX).regex(IDENTIFIER_PATTERN);
export const aliasSchema = identifierSchema.max(ALIAS_MAX).nullable();
export const isIdentifier = (value: string, max: number = NAME_MAX): boolean => value.length <= max && IDENTIFIER_PATTERN.test(value);

const id = z.number().int().positive();
const name = z.string().min(1).max(NAME_MAX);
const identifier = identifierSchema;
const alias = aliasSchema;
const description = z.string().max(TEXT_MAX).nullable();
const localized = z.strictObject({ en: z.string().min(1).max(TEXT_MAX), he: z.string().min(1).max(TEXT_MAX) });

const columnSchema = z.strictObject({ name: identifier, dataType: z.string().max(NAME_MAX) });
export type EntityColumn = z.infer<typeof columnSchema>;

const entitySchema = z.strictObject({
  id,
  key: identifier,
  sourceDatabase: z.enum(SOURCE_DATABASES),
  tableName: identifier,
  entityType: z.enum(ENTITY_TYPES),
  description,
  isActive: z.boolean(),
  columns: z.array(columnSchema),
});
export type Entity = z.infer<typeof entitySchema>;

const joinShape = { joinType: z.enum(JOIN_TYPES), sourceColumn: identifier, targetColumn: identifier, alias, description };
const relationshipSchema = z.strictObject({ id, sourceEntityId: id, targetEntityId: id, ...joinShape });
export type Relationship = z.infer<typeof relationshipSchema>;

const linkShape = { alias, isBaseEntity: z.boolean(), order: z.number().int().min(0) };
const reportEntitySchema = z.strictObject({ id, reportId: name, entityId: id, relationshipId: id.nullable(), ...linkShape });
export type ReportEntity = z.infer<typeof reportEntitySchema>;

/** A report column in a JSON file. Entities and columns are named by key, never by id. */
export const portableFieldSchema = z.strictObject({
  key: identifier,
  entityKey: identifier,
  columnName: identifier,
  fieldType: z.enum(FIELD_TYPES).optional(),
  label: localized.optional(),
  isAnchor: z.boolean().optional(),
});
export type PortableField = z.infer<typeof portableFieldSchema>;

export const portableReportEntitySchema = z.strictObject({ entityKey: identifier, ...linkShape });
export type PortableReportEntity = z.infer<typeof portableReportEntitySchema>;

export const portableRelationshipSchema = z.strictObject({ sourceEntityKey: identifier, targetEntityKey: identifier, ...joinShape });
export type PortableRelationship = z.infer<typeof portableRelationshipSchema>;

/** A saved view in a report bundle, matched by name. The state is checked by the views feature's own schema. */
export const portableViewSchema = z.strictObject({
  name: z.string().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
  description: z.string().max(TEXT_MAX),
  pageType: name,
  state: storedStateSchema,
});
export type PortableView = z.infer<typeof portableViewSchema>;

export const dataModelSchema = z.strictObject({
  entities: z.array(entitySchema),
  relationships: z.array(relationshipSchema),
  reportEntities: z.array(reportEntitySchema),
  /** Field definitions an admin imported, per report id. Built-in fields stay in src/data/reports.ts. */
  fields: z.record(z.string(), z.array(portableFieldSchema)),
});
export type DataModel = z.infer<typeof dataModelSchema>;

export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };

export const nextId = (rows: readonly { id: number }[]): number => Math.max(0, ...rows.map((row) => row.id)) + 1;
