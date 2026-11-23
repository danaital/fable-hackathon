import type { Cell, Row as SheetRow, Workbook, Worksheet } from "exceljs";
import type { Row } from "@/data/types";
import { exportCell, type ExportCell } from "./cells";
import type { ExportPlan } from "./plan";
import { uniqueSheetName } from "./safety";
import type { SectionStyle } from "./schema";
import { canBeFormula, summaryCell, summaryFormula, summaryLabel } from "./summary";

const MIN_WIDTH = 15;
const MAX_WIDTH = 50;
const WIDTH_PADDING = 2;
const OPAQUE = "FF";
const WHITE = "#ffffff";
const BORDER_ARGB = "FF1F3864";
const THIN_BORDER = { style: "thin", color: { argb: BORDER_ARGB } } as const;

/** One workbook being written: sheet names already used, so every new sheet gets a unique one. */
export interface Book {
  workbook: Workbook;
  plan: ExportPlan;
  taken: Set<string>;
}

/** A worksheet plus the widest text seen per column, for the column widths. */
export interface Sheet {
  ws: Worksheet;
  widths: number[];
}

/** First and last worksheet row of a block of data rows. */
export interface RowRange {
  first: number;
  last: number;
}

const argb = (hex: string) => `${OPAQUE}${hex.slice(1).toUpperCase()}`;

export function applyStyle(cell: Cell, { background, fontFamily, fontSize, fontColor, bold, italic, underline }: SectionStyle): void {
  cell.font = { name: fontFamily, size: fontSize, color: { argb: argb(fontColor) }, bold, italic, underline };
  // A white fill would only hide the sheet's grid lines.
  if (background.toLowerCase() !== WHITE) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(background) } };
}

interface AddSheetInput {
  book: Book;
  name: string;
  fallback: string;
  /** Keep the first row in place while scrolling. */
  frozen?: boolean;
}

export function addSheet({ book, name, fallback, frozen = true }: AddSheetInput): Sheet {
  const { rtl } = book.plan;
  const view = frozen ? { state: "frozen" as const, ySplit: 1, rightToLeft: rtl } : { rightToLeft: rtl };
  return { ws: book.workbook.addWorksheet(uniqueSheetName(name, book.taken, fallback), { views: [view] }), widths: [] };
}

interface PutInput {
  sheet: Sheet;
  row: SheetRow;
  /** Zero-based column. */
  index: number;
  content: ExportCell;
  style?: SectionStyle;
}

/** Writes one cell. Text always goes in as a string value, so it can never be read as a formula. */
export function put({ sheet, row, index, content, style }: PutInput): Cell {
  const cell = row.getCell(index + 1);
  cell.value = content.value;
  if (content.numFmt) cell.numFmt = content.numFmt;
  if (style) applyStyle(cell, style);
  sheet.widths[index] = Math.max(sheet.widths[index] ?? 0, content.text.length);
  return cell;
}

export const textCell = (text: string): ExportCell => ({ value: text, text });

export function writeHeader(sheet: Sheet, headers: readonly string[], style: SectionStyle): void {
  const row = sheet.ws.addRow([]);
  headers.forEach((header, index) => {
    const cell = put({ sheet, row, index, content: textCell(header), style });
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
  });
}

/** Writes the rows under each other and reports where they landed; null when there were none. */
export function writeDataRows(sheet: Sheet, plan: ExportPlan, rows: readonly Row[]): RowRange | null {
  // shortcut: one synchronous pass; write in chunks with a pause between them once reports pass ~50,000 rows.
  const numbers = rows.map((data) => {
    const row = sheet.ws.addRow([]);
    plan.columns.forEach(({ field }, index) => put({ sheet, row, index, content: exportCell(field, data, plan.env), style: plan.design.values }));
    return row.number;
  });
  return numbers.length > 0 ? { first: numbers[0], last: numbers[numbers.length - 1] } : null;
}

interface SummaryRowInput {
  sheet: Sheet;
  plan: ExportPlan;
  /** The rows being summarized. */
  rows: readonly Row[];
  style: SectionStyle;
  /** Where those rows sit on this sheet. Given: live formulas over that range. Absent: plain values. */
  range?: RowRange | null;
}

/** A blank row, then the label in the first column and one calculation under each configured column. */
export function writeSummaryRow({ sheet, plan, rows, style, range }: SummaryRowInput): void {
  const { summary, columns, env } = plan;
  if (!summary) return;
  sheet.ws.addRow([]);
  const row = sheet.ws.addRow([]);
  columns.forEach((column, index) => {
    // The label owns the first column, so a calculation configured there is not shown.
    if (index === 0) return put({ sheet, row, index, content: textCell(summaryLabel(summary.label, rows.length)), style });
    const config = summary.fields.find(({ field }) => field.key === column.field.key);
    const content = config ? summaryCell({ calc: config.calc, field: config.field, rows, env }) : { value: null, text: "" };
    const cell = put({ sheet, row, index, content, style });
    if (config && range && canBeFormula(content)) {
      const { letter } = sheet.ws.getColumn(index + 1);
      cell.value = { formula: summaryFormula(config.calc, `${letter}${range.first}:${letter}${range.last}`), result: content.value };
    }
    return cell;
  });
}

export function finishSheet({ ws, widths }: Sheet): void {
  widths.forEach((width, index) => {
    ws.getColumn(index + 1).width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width + WIDTH_PADDING));
  });
}
