import { exportCell, type ExportCell } from "./cells";
import type { ExportPlan } from "./plan";
import { neutralizeFormula } from "./safety";
import type { CsvDelimiter } from "./schema";

const DELIMITER: Record<CsvDelimiter, string> = { comma: ",", semicolon: ";", tab: "\t" };
const LINE_BREAK = "\n";
// Without the byte-order mark Excel reads the file in the local code page and Hebrew turns into noise.
export const UTF8_BOM = "﻿";
export const CSV_MIME = "text/csv;charset=utf-8";

function quote(text: string, delimiter: string): string {
  const needsQuotes = text.includes(delimiter) || /["\r\n]/.test(text);
  return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Text is neutralized; a cell that holds a real number or date was formatted by the generator and is safe. */
const cellText = (cell: ExportCell): string => (typeof cell.value === "string" ? neutralizeFormula(cell.text) : cell.text);

/** The whole file as text: optional metadata block, header line (always), one line per row. */
export function buildCsv({ columns, rows, env, metadata, csvDelimiter }: ExportPlan): string {
  const delimiter = DELIMITER[csvDelimiter];
  const line = (cells: readonly string[]) => cells.map((cell) => quote(cell, delimiter)).join(delimiter);
  const safe = (cells: readonly string[]) => line(cells.map(neutralizeFormula));

  const lines = [
    ...(metadata ? [...metadata.map(({ label, value }) => safe([label, value])), ""] : []),
    safe(columns.map((column) => column.header)),
    ...rows.map((row) => line(columns.map(({ field }) => cellText(exportCell(field, row, env))))),
  ];
  return UTF8_BOM + lines.join(LINE_BREAK) + LINE_BREAK;
}
