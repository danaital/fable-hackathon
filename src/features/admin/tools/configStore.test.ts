import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSummaryConfig, summaryConfigStore } from "@/features/summary/summaryConfig";
import { viewsRepository } from "@/features/views/repository";
import { planImport, type ReportConfig } from "./configImport";
import { mergeSections, modelSections } from "./configModel";
import { applyReportConfig, importContext, loadReportConfig, undoReportImport } from "./configStore";
import { EXAMPLE_IMPORT, EXAMPLE_REPORT_ID } from "./example";
import { SEED_DATA_MODEL, dataModelRepository } from "./repository";
import { fakeWindow } from "./testWindow";

const REPORT = EXAMPLE_REPORT_ID;
const EXAMPLE_IDS = ["example_cancelled_orders", "example_top_countries", "example_orders_by_agent"];
const DATA_MODEL_KEY = "bahir_admin_data_model";

const summaryIds = () => {
  const { widgets, charts } = getSummaryConfig(REPORT);
  return [...widgets, ...charts].map((item) => item.id);
};

function plan(value: unknown): ReportConfig {
  const result = planImport({ kind: "bundle", value, baseline: loadReportConfig(REPORT), context: importContext("en") });
  if (!result.ok || !result.value.next) throw new Error("the file must be importable");
  return result.value.next;
}

beforeEach(() => vi.stubGlobal("window", fakeWindow()));
afterEach(() => vi.unstubAllGlobals());

describe("applying and undoing a report import", () => {
  it("the example file is valid and creates its three items", () => {
    const result = planImport({ kind: "bundle", value: EXAMPLE_IMPORT, baseline: loadReportConfig(REPORT), context: importContext("en") });
    expect(result.ok && result.value.counts).toEqual({ create: 3, update: 0, unchanged: 0, invalid: 0 });
  });

  it("writes widgets and charts through the summary store, and importing twice changes nothing", () => {
    const builtIn = summaryIds();
    expect(applyReportConfig(REPORT, plan(EXAMPLE_IMPORT))).not.toBeNull();
    expect(summaryIds()).toEqual(expect.arrayContaining([...builtIn, ...EXAMPLE_IDS]));
    expect(Object.keys(summaryConfigStore.read())).toEqual([REPORT]);

    const again = planImport({ kind: "bundle", value: EXAMPLE_IMPORT, baseline: loadReportConfig(REPORT), context: importContext("en") });
    expect(again.ok && again.value.counts).toEqual({ create: 0, update: 0, unchanged: 3, invalid: 0 });
  });

  it("undo puts the summary, the data model and the views back", () => {
    const view = { name: "Imported view", description: "", pageType: "summary", state: {} };
    const field = { key: "customer", entityKey: "orders", columnName: "customer", label: { en: "Client", he: "לקוח" } };
    const undo = applyReportConfig(REPORT, plan({ ...EXAMPLE_IMPORT, fields: [field], views: [view] }));
    if (!undo) throw new Error("the import must be stored");
    expect(viewsRepository.list().map((item) => item.name)).toEqual(["Imported view"]);
    expect(dataModelRepository.read().fields[REPORT]).toEqual([field]);

    expect(undoReportImport(undo)).toBe("undone");
    expect(summaryIds()).not.toEqual(expect.arrayContaining(EXAMPLE_IDS));
    expect(summaryConfigStore.read()).toEqual({});
    expect(dataModelRepository.read()).toEqual(SEED_DATA_MODEL);
    expect(viewsRepository.list()).toEqual([]);
  });

  it("undo is refused when something changed after the import, so the later edit is kept", () => {
    const undo = applyReportConfig(REPORT, plan(EXAMPLE_IMPORT));
    if (!undo) throw new Error("the import must be stored");
    const model = dataModelRepository.read();
    const edited = { ...model, entities: model.entities.map((entity) => ({ ...entity, description: "edited later" })) };
    dataModelRepository.write(edited);

    expect(undoReportImport(undo)).toBe("changed");
    expect(dataModelRepository.read()).toEqual(edited);
    expect(summaryIds()).toEqual(expect.arrayContaining(EXAMPLE_IDS));
  });

  it("stores nothing when the browser refuses one of the writes", () => {
    vi.stubGlobal("window", fakeWindow([DATA_MODEL_KEY]));
    expect(applyReportConfig(REPORT, plan(EXAMPLE_IMPORT))).toBeNull();
    expect(summaryConfigStore.read()).toEqual({});
    expect(summaryIds()).not.toEqual(expect.arrayContaining(EXAMPLE_IDS));
  });
});

describe("portable sections of the data model", () => {
  it("round-trips: merging a report's own sections changes no row and no id", () => {
    const merged = mergeSections({ model: SEED_DATA_MODEL, reportId: REPORT, next: modelSections(SEED_DATA_MODEL, REPORT) });
    expect(merged).toEqual({ ...SEED_DATA_MODEL, fields: { [REPORT]: [] } });
  });

  it("a new relationship gets the next id, a matching one keeps its id, and nothing is removed", () => {
    const sections = modelSections(SEED_DATA_MODEL, REPORT);
    const [existing] = sections.entityRelationships;
    const added = { ...existing, alias: "billing_customer" };
    const next = { ...sections, entityRelationships: [{ ...existing, joinType: "INNER" as const }, added] };
    const { relationships } = mergeSections({ model: SEED_DATA_MODEL, reportId: REPORT, next });

    expect(relationships).toHaveLength(SEED_DATA_MODEL.relationships.length + 1);
    expect(relationships[0]).toEqual({ ...SEED_DATA_MODEL.relationships[0], joinType: "INNER" });
    expect(relationships.at(-1)).toMatchObject({ id: SEED_DATA_MODEL.relationships.length + 1, alias: "billing_customer" });
  });
});
