import { describe, expect, it } from "vitest";
import {
  NEW_RELATIONSHIP,
  deleteEntity,
  deleteRelationship,
  deleteReportEntity,
  saveEntity,
  saveRelationship,
  saveReportEntity,
  type EntityDraft,
  type RelationshipDraft,
  type ReportEntityDraft,
} from "./dataModelRules";
import { dataModelSchema, type DataModel, type Result } from "./model";
import { SEED_DATA_MODEL as SEED } from "./repository";

// A quote, a space, a semicolon, a dot and a leading digit: none may become a key or an alias.
const BAD = ['a"b', "a b", "a;b", "a.b", "1ab"];
const idOf = (key: string, model: DataModel = SEED): number => model.entities.find((entity) => entity.key === key)?.id ?? 0;
const ORDERS = idOf("orders");
const CUSTOMERS = idOf("customers");
const PRODUCTS = idOf("products");

function ok<E extends string>(result: Result<DataModel, E>): DataModel {
  if (!result.ok) throw new Error(`refused: ${result.error}`);
  expect(dataModelSchema.safeParse(result.value).success).toBe(true);
  return result.value;
}

const entity: EntityDraft = { key: "billing_customers", tableName: "customers", entityType: "view", description: " Paying side ", isActive: true };
const join: RelationshipDraft = { ...NEW_RELATIONSHIP, sourceEntityId: ORDERS, targetEntityId: PRODUCTS, sourceColumn: "items", targetColumn: "sku" };
const link: ReportEntityDraft = { reportId: "orders", entityId: PRODUCTS, alias: "product", isBaseEntity: false, order: 2 };

describe("entities", () => {
  it("adds an entity on a known table with the next id and that table's columns", () => {
    const model = ok(saveEntity({ model: SEED, draft: entity }));
    expect(model.entities.at(-1)).toMatchObject({ id: SEED.entities.length + 1, key: "billing_customers", sourceDatabase: "source", tableName: "customers", entityType: "view", description: "Paying side" });
    expect(model.entities.at(-1)?.columns).toEqual(SEED.entities[CUSTOMERS - 1].columns);
  });

  it("refuses an unsafe key, a key in use and a table that does not exist", () => {
    for (const bad of BAD) expect(saveEntity({ model: SEED, draft: { ...entity, key: bad } })).toEqual({ ok: false, error: "identifier" });
    expect(saveEntity({ model: SEED, draft: { ...entity, key: "" } })).toEqual({ ok: false, error: "identifier" });
    expect(saveEntity({ model: SEED, draft: { ...entity, key: "orders" } })).toEqual({ ok: false, error: "duplicateKey" });
    expect(saveEntity({ model: SEED, draft: { ...entity, tableName: "no_such_table" } })).toEqual({ ok: false, error: "unknownTable" });
    expect(saveEntity({ model: SEED, draft: { ...entity, tableName: "a;b" } })).toEqual({ ok: false, error: "identifier" });
  });

  it("editing changes the status, type and description only: key and table are fixed", () => {
    const model = ok(saveEntity({ model: SEED, draft: { ...entity, key: "renamed", tableName: "products", isActive: false }, editingId: ORDERS }));
    expect(model.entities[ORDERS - 1]).toEqual({ ...SEED.entities[ORDERS - 1], entityType: "view", description: "Paying side", isActive: false });
  });

  it("will not delete the entity a report starts from", () => {
    expect(deleteEntity(SEED, ORDERS)).toEqual({ ok: false, error: "isBase" });
  });

  it("deleting removes the entity's relationships, report links and imported fields, and nothing else", () => {
    const added = ok(saveEntity({ model: SEED, draft: entity }));
    const id = idOf("billing_customers", added);
    const joined = ok(saveRelationship({ model: added, draft: { ...join, targetEntityId: id, sourceColumn: "customer", targetColumn: "name", alias: "billing" } }));
    const linked = ok(saveReportEntity({ model: joined, draft: { ...link, entityId: id, alias: "billing" } }));
    expect(linked.reportEntities.at(-1)).toMatchObject({ relationshipId: joined.relationships.at(-1)?.id, alias: "billing" });
    const withField = { ...linked, fields: { orders: [{ key: "billing_name", entityKey: "billing_customers", columnName: "name" }, { key: "customer", entityKey: "orders", columnName: "customer" }] } };

    expect(ok(deleteEntity(withField, id))).toEqual({ ...SEED, fields: { orders: [withField.fields.orders[1]] } });
  });
});

describe("relationships", () => {
  it("adds a join between two active entities on columns they have", () => {
    const model = ok(saveRelationship({ model: SEED, draft: { ...join, alias: " product ", description: "" } }));
    expect(model.relationships.at(-1)).toEqual({ id: SEED.relationships.length + 1, sourceEntityId: ORDERS, targetEntityId: PRODUCTS, joinType: "LEFT", sourceColumn: "items", targetColumn: "sku", alias: "product", description: null });
  });

  it("checks the rules in order and names the first one that fails", () => {
    const refused = (draft: RelationshipDraft, model = SEED) => saveRelationship({ model, draft });
    expect(refused({ ...join, targetEntityId: null })).toEqual({ ok: false, error: "required" });
    expect(refused({ ...join, sourceColumn: "" })).toEqual({ ok: false, error: "required" });
    expect(refused({ ...join, targetEntityId: ORDERS, targetColumn: "items" })).toEqual({ ok: false, error: "sameEntity" });
    expect(refused({ ...join, targetColumn: "no_such_column" })).toEqual({ ok: false, error: "unknownColumn" });
    for (const bad of BAD) expect(refused({ ...join, alias: bad })).toEqual({ ok: false, error: "identifier" });
    expect(refused({ ...join, alias: "a".repeat(101) })).toEqual({ ok: false, error: "identifier" });

    const inactive = ok(saveEntity({ model: SEED, draft: { ...entity, isActive: false }, editingId: PRODUCTS }));
    expect(refused(join, inactive)).toEqual({ ok: false, error: "inactive" });

    const [existing] = SEED.relationships;
    const copy: RelationshipDraft = { ...existing, alias: existing.alias ?? "", description: "" };
    expect(refused(copy)).toEqual({ ok: false, error: "duplicate" });
    expect(refused({ ...copy, alias: "" })).toEqual({ ok: false, error: "aliasRequired" });
    expect(refused({ ...copy, joinType: "INNER" })).toEqual({ ok: false, error: "aliasTaken" });
    expect(ok(refused({ ...copy, alias: "billing_customer" })).relationships).toHaveLength(SEED.relationships.length + 1);
  });

  it("editing keeps the id and does not collide with itself", () => {
    const [existing] = SEED.relationships;
    const model = ok(saveRelationship({ model: SEED, draft: { ...existing, alias: existing.alias ?? "", description: "Who ordered", joinType: "INNER" }, editingId: existing.id }));
    expect(model.relationships[0]).toEqual({ ...existing, joinType: "INNER", description: "Who ordered" });
    expect(model.relationships).toHaveLength(SEED.relationships.length);
  });

  it("deleting leaves the report links in place without the join", () => {
    const [existing] = SEED.relationships;
    const model = deleteRelationship(SEED, existing.id);
    expect(model.relationships.some((row) => row.id === existing.id)).toBe(false);
    expect(model.reportEntities).toHaveLength(SEED.reportEntities.length);
    expect(model.reportEntities.some((row) => row.relationshipId === existing.id)).toBe(false);
    expect(dataModelSchema.safeParse(model).success).toBe(true);
  });
});

describe("report entities", () => {
  const refused = (draft: ReportEntityDraft, model = SEED) => saveReportEntity({ model, draft });

  it("links an entity to a report under an alias", () => {
    const model = ok(refused(link));
    expect(model.reportEntities.at(-1)).toEqual({ id: SEED.reportEntities.length + 1, reportId: "orders", entityId: PRODUCTS, relationshipId: null, alias: "product", isBaseEntity: false, order: 2 });
  });

  it("refuses bad input and names the reason", () => {
    expect(refused({ ...link, entityId: null })).toEqual({ ok: false, error: "required" });
    expect(refused({ ...link, reportId: "no_such_report" })).toEqual({ ok: false, error: "unknownReport" });
    for (const bad of BAD) expect(refused({ ...link, alias: bad })).toEqual({ ok: false, error: "identifier" });
    for (const order of [-1, 1.5, Number.NaN]) expect(refused({ ...link, order })).toEqual({ ok: false, error: "order" });
    expect(refused({ ...link, entityId: ORDERS, alias: "" })).toEqual({ ok: false, error: "duplicate" });
    expect(refused({ ...link, alias: "customer" })).toEqual({ ok: false, error: "aliasTaken" });
    const inactive = ok(saveEntity({ model: SEED, draft: { ...entity, isActive: false }, editingId: PRODUCTS }));
    expect(refused(link, inactive)).toEqual({ ok: false, error: "inactive" });
  });

  it("a report always has exactly one base entity", () => {
    const base = SEED.reportEntities.find((row) => row.reportId === "orders" && row.isBaseEntity);
    if (!base) throw new Error("the seed has a base for orders");
    const unmarked = { reportId: "orders", entityId: base.entityId, alias: "", isBaseEntity: false, order: 0 };
    expect(saveReportEntity({ model: SEED, draft: unmarked, editingId: base.id })).toEqual({ ok: false, error: "noBase" });

    const moved = ok(refused({ ...link, isBaseEntity: true }));
    expect(moved.reportEntities.filter((row) => row.reportId === "orders" && row.isBaseEntity).map((row) => row.entityId)).toEqual([PRODUCTS]);
    expect(moved.reportEntities.filter((row) => row.reportId !== "orders")).toEqual(SEED.reportEntities.filter((row) => row.reportId !== "orders"));
  });

  it("editing changes alias, base and order; report and entity are fixed", () => {
    const joined = SEED.reportEntities.find((row) => row.reportId === "orders" && !row.isBaseEntity);
    if (!joined) throw new Error("the seed joins customers to orders");
    const model = ok(saveReportEntity({ model: SEED, draft: { reportId: "tickets", entityId: PRODUCTS, alias: "customer", isBaseEntity: false, order: 5 }, editingId: joined.id }));
    expect(model.reportEntities.find((row) => row.id === joined.id)).toEqual({ ...joined, order: 5 });
  });

  it("will not remove the base row, nor a row that imported fields still read through", () => {
    const base = SEED.reportEntities.find((row) => row.reportId === "orders" && row.isBaseEntity);
    const joined = SEED.reportEntities.find((row) => row.reportId === "orders" && !row.isBaseEntity);
    if (!base || !joined) throw new Error("the seed has both rows");
    expect(deleteReportEntity(SEED, base.id)).toEqual({ ok: false, error: "isBase" });
    const withField = { ...SEED, fields: { orders: [{ key: "customer_name", entityKey: "customers", columnName: "name" }] } };
    expect(deleteReportEntity(withField, joined.id)).toEqual({ ok: false, error: "fieldsInUse" });
    expect(ok(deleteReportEntity(SEED, joined.id)).reportEntities).toEqual(SEED.reportEntities.filter((row) => row.id !== joined.id));
  });
});
