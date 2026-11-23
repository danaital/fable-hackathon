import type { Workbook } from "exceljs";
import { exportCell, type ExportCell } from "./cells";
import { groupRows, type RowGroup } from "./groups";
import type { ExportPlan } from "./plan";
import type { OutputMode } from "./schema";
import { addSheet, applyStyle, finishSheet, put, textCell, writeDataRows, writeHeader, writeSummaryRow, type Book, type Sheet } from "./sheet";
import { summaryCell } from "./summary";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const HEADING_ARGB = "FFE7E6E6";
const EMPTY: ExportCell = { value: null, text: "" };
const countCell = (count: number): ExportCell => ({ value: count, text: String(count) });

const headers = (plan: ExportPlan) => plan.columns.map((column) => column.header);

function dataSheet(book: Book, name: string, fallback: string): Sheet {
  const sheet = addSheet({ book, name, fallback });
  writeHeader(sheet, headers(book.plan), book.plan.design.header);
  return sheet;
}

/** One sheet: header, then either the plain rows or one block per group, then the overall summary row. */
function writeSingleSheet(book: Book, groups: readonly RowGroup[] | null): void {
  const { plan } = book;
  const { design } = plan;
  const sheet = dataSheet(book, plan.t("export.sheet.data"), plan.t("export.sheet.data"));
  let range = null;
  if (!groups) range = writeDataRows(sheet, plan, plan.rows);
  for (const group of groups ?? []) {
    const row = sheet.ws.addRow([]);
    put({ sheet, row, index: 0, content: { value: group.label, text: "" }, style: design.groupSummaryRow });
    if (plan.columns.length > 1) sheet.ws.mergeCells(row.number, 1, row.number, plan.columns.length);
    writeDataRows(sheet, plan, group.rows);
    if (plan.grouping?.innerSummary) writeSummaryRow({ sheet, plan, rows: group.rows, style: design.groupSummaryRow });
  }
  // Group header and inner summary rows sit between the data rows, so a formula over the column would count them too.
  writeSummaryRow({ sheet, plan, rows: plan.rows, style: design.summaryRow, range: groups ? null : range });
  finishSheet(sheet);
}

/** One sheet per group. The group owns its sheet, so its summary row can be live formulas. */
function writeGroupSheets(book: Book, groups: readonly RowGroup[]): void {
  const { plan } = book;
  groups.forEach((group, index) => {
    const sheet = dataSheet(book, group.sheetName, plan.t("export.sheet.group", { n: index + 1 }));
    const range = writeDataRows(sheet, plan, group.rows);
    if (plan.grouping?.innerSummary) writeSummaryRow({ sheet, plan, rows: group.rows, style: plan.design.groupSummaryRow, range });
    finishSheet(sheet);
  });
}

/** First sheet of "split with summary": one row per group with its count and calculations, then the grand total. */
function writeSummarySheet(book: Book, groups: readonly RowGroup[]): void {
  const { plan } = book;
  const { grouping, summary, env, t, design } = plan;
  if (!grouping) return;
  const calcs = summary?.fields ?? [];
  const sheet = addSheet({ book, name: t("export.sheet.summary"), fallback: t("export.sheet.summary") });
  writeHeader(
    sheet,
    [
      ...grouping.fields.map((field) => t(field.labelKey)),
      t("export.summarySheet.count"),
      ...calcs.map(({ field, calc }) => `${t(field.labelKey)} (${t(`export.calc.${calc}`)})`),
    ],
    design.header,
  );
  const writeLine = (cells: readonly ExportCell[], style: typeof design.values) => {
    const row = sheet.ws.addRow([]);
    cells.forEach((content, index) => put({ sheet, row, index, content, style }));
  };
  for (const { rows } of groups) {
    writeLine(
      [
        ...grouping.fields.map((field) => exportCell(field, rows[0], env)),
        countCell(rows.length),
        ...calcs.map(({ field, calc }) => summaryCell({ calc, field, rows, env })),
      ],
      design.values,
    );
  }
  if (grouping.includeGrandTotal) {
    sheet.ws.addRow([]);
    writeLine(
      [
        textCell(t("export.summarySheet.grandTotal")),
        ...grouping.fields.slice(1).map(() => EMPTY),
        countCell(plan.rows.length),
        ...calcs.map(({ field, calc }) => summaryCell({ calc, field, rows: plan.rows, env })),
      ],
      design.summaryRow,
    );
  }
  finishSheet(sheet);
}

const GROUPED: Record<OutputMode, (book: Book, groups: readonly RowGroup[]) => void> = {
  single_sheet: writeSingleSheet,
  split_sheets: writeGroupSheets,
  split_with_summary: (book, groups) => {
    writeSummarySheet(book, groups);
    writeGroupSheets(book, groups);
  },
};

function writeInfoSheet(book: Book): void {
  const { plan } = book;
  const name = plan.t("export.sheet.info");
  const sheet = addSheet({ book, name, fallback: name, frozen: false });
  for (const { label, value, heading } of plan.metadata ?? []) {
    const row = sheet.ws.addRow([]);
    [label, value].forEach((text, index) => {
      const cell = put({ sheet, row, index, content: textCell(text) });
      if (!heading) return;
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADING_ARGB } };
    });
  }
  finishSheet(sheet);
}

/** Each chosen chart as its data table on its own sheet. */
function writeChartSheets(book: Book): void {
  const { plan } = book;
  plan.charts.forEach((chart, index) => {
    const sheet = addSheet({ book, name: chart.title, fallback: plan.t("export.sheet.chart", { n: index + 1 }) });
    writeHeader(sheet, [plan.t("export.chart.category"), plan.t("export.chart.value")], plan.design.header);
    for (const { category, value } of chart.rows) {
      const row = sheet.ws.addRow([]);
      put({ sheet, row, index: 0, content: textCell(category), style: plan.design.values });
      put({ sheet, row, index: 1, content: countCell(value), style: plan.design.values });
    }
    finishSheet(sheet);
  });
}

/** Fills an empty workbook from the plan. Pure apart from the workbook it writes into, so tests can read it back. */
export function buildWorkbook(workbook: Workbook, plan: ExportPlan): void {
  const book: Book = { workbook, plan, taken: new Set() };
  // Nothing to split when no row matched: fall back to the plain sheet so the file still has its header.
  const groups = plan.grouping && plan.rows.length > 0 ? groupRows(plan) : null;
  if (groups && plan.grouping) GROUPED[plan.grouping.outputMode](book, groups);
  else writeSingleSheet(book, null);
  if (plan.metadata) writeInfoSheet(book);
  writeChartSheets(book);
}

export { applyStyle };
