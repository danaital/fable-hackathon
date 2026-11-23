import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { ReportDef, Row } from "@/data/types";
import { defaultViewState } from "@/features/report/viewState";
import { UTF8_BOM, buildCsv } from "./csv";
import { restoreDraft } from "./draft";
import { buildPlan, type PageContext } from "./plan";
import type { ExportTemplate, WizardState } from "./schema";
import { canJumpTo, clampStep, nextStep, validateStep, visibleSteps } from "./steps";
import { applyTemplate, initialState, wizardReducer } from "./wizardState";
import { buildWorkbook } from "./workbook";

const report: ReportDef = {
  id: "orders",
  titleKey: "report.orders.title",
  descKey: "report.orders.desc",
  icon: "orders",
  tags: [],
  fields: [
    { key: "orderId", type: "string", labelKey: "field.orderId" },
    { key: "customer", type: "string", labelKey: "field.customer" },
    { key: "status", type: "status", labelKey: "field.status", optionPrefix: "status" },
    { key: "items", type: "number", labelKey: "field.items" },
  ],
};
const rows: Row[] = [
  { orderId: "A-1", customer: "=HYPERLINK(1)", status: "late", items: 2 },
  { orderId: "A-2", customer: 'Cedar, "Books"', status: "late", items: 5 },
  { orderId: "A-3", customer: "Willow", status: "shipped", items: -1 },
];
const view = defaultViewState(report);
const page: PageContext = { report, rows, filteredRows: rows, view, savedViews: [], currentViewId: null, templates: [], charts: [], uiLocale: "en" };
const base = initialState({ report, view, locale: "en", charts: [], fileTemplates: [], totalLabel: "Total {{total}}" });
const now = new Date("2026-11-23T10:00:00Z");
const env = { hasCharts: false };

const workbookFor = (state: WizardState) => {
  const workbook = new ExcelJS.Workbook();
  buildWorkbook(workbook, buildPlan(state, page, now));
  return workbook;
};

describe("CSV", () => {
  const csv = buildCsv(buildPlan({ ...base, format: "csv", includeMetadata: false }, page, now));
  const lines = csv.slice(1).split("\n");

  it("starts with a byte-order mark and always has the header line", () => {
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(lines[0]).toBe("Order,Customer,Status,Items");
  });

  it("neutralizes formula text and quotes separators and quotes", () => {
    expect(lines[1]).toBe("A-1,'=HYPERLINK(1),Late,2");
    expect(lines[2]).toBe('A-2,"Cedar, ""Books""",Late,5');
  });

  it("leaves real numbers alone, also negative ones", () => {
    expect(lines[3]).toBe("A-3,Willow,Shipped,-1");
  });
});

describe("XLSX workbook", () => {
  const summary = { enabled: true, label: "Total {{total}}", fields: [{ field: "items", calc: "sum" as const }] };

  it("writes text that looks like a formula as a string cell and the summary as a live formula", () => {
    const sheet = workbookFor({ ...base, summary, includeMetadata: false }).worksheets[0];
    expect(sheet.name).toBe("Data");
    expect(sheet.getCell("B2").type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell("B2").value).toBe("=HYPERLINK(1)");
    expect(sheet.getCell("A6").value).toBe("Total 3");
    expect(sheet.getCell("D6").value).toEqual({ formula: "SUM(D2:D4)", result: 6 });
  });

  it("splits groups into sheets with a summary sheet first", () => {
    const grouping = { enabled: true, groupBy: ["status"], innerSummary: true, outputMode: "split_with_summary" as const, includeGrandTotal: true };
    const workbook = workbookFor({ ...base, summary, grouping, includeMetadata: false });
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Status - Late", "Status - Shipped"]);
    expect(workbook.worksheets[0].getCell("B2").value).toBe(2);
    expect(workbook.worksheets[1].getCell("D5").value).toEqual({ formula: "SUM(D2:D3)", result: 7 });
  });

  it("writes a Hebrew file right to left", () => {
    const formatting = { ...base.formatting, useDefaultLanguage: false, language: "he" as const };
    expect(workbookFor({ ...base, formatting }).worksheets[0].views[0].rightToLeft).toBe(true);
  });
});

describe("wizard steps", () => {
  it("hides the steps that do not apply and clamps the position", () => {
    expect(visibleSteps(base, env)).not.toContain("fields");
    expect(visibleSteps({ ...base, source: "custom" }, env)).toContain("fields");
    const csvSteps = visibleSteps({ ...base, format: "csv" }, env);
    expect(csvSteps).not.toContain("summary");
    expect(csvSteps).not.toContain("fileTemplate");
    expect(clampStep("fields", visibleSteps(base, env))).toBe("source");
  });

  it("validates, moves forward only when valid and never jumps ahead", () => {
    const visible = visibleSteps(base, env);
    expect(validateStep("source", { ...base, source: "other_view" }, env)).toBe("export.invalid.view");
    expect(nextStep({ step: "source", visible, valid: false })).toBeNull();
    expect(nextStep({ step: "format", visible, valid: true })).toBe("source");
    expect(canJumpTo("format", { step: "sort", visible, valid: true })).toBe(true);
    expect(canJumpTo("review", { step: "sort", visible, valid: true })).toBe(false);
  });
});

describe("wizard state", () => {
  const template: ExportTemplate = {
    id: "t1",
    name: "Late orders",
    reportId: "orders",
    format: "csv",
    columns: ["orderId", "items"],
    filters: [],
    filterRelation: "and",
    sorts: [{ key: "items", direction: "desc" }],
    grouping: base.grouping,
    summary: base.summary,
    charts: base.charts,
    fileTemplateId: null,
    isDefault: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  it("applies a template and clears it again when the source changes", () => {
    const applied = applyTemplate({ state: base, template, fileTemplates: [], defaults: base });
    expect(applied).toMatchObject({ source: "template", templateId: "t1", format: "csv", selectedFields: ["orderId", "items"] });
    const plan = buildPlan(applied, { ...page, templates: [template] }, now);
    expect(plan.columns.map((column) => column.field.key)).toEqual(["orderId", "items"]);
    expect(plan.rows.map((row) => row.items)).toEqual([5, 2, -1]);
    const left = wizardReducer(applied, { type: "setSource", source: "custom", defaults: base });
    expect(left).toMatchObject({ format: "xlsx", templateId: null, filtersSource: "current" });
  });

  it("restores a draft member by member", () => {
    expect(restoreDraft({ format: "csv", step: "nonsense" }, base)).toMatchObject({ format: "csv", step: "format" });
  });
});
