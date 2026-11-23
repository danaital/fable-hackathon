import type { FieldDef, FieldType, Row } from "@/data/types";
import { computeTotal, isAggregate, totalOptions, type TotalResult } from "@/features/grid/totals";
import type { Aggregate } from "@/features/report/viewState";
import { EMPTY_CELL, exportCell, type CellEnv, type ExportCell } from "./cells";

const TOTAL_TOKEN = "{{total}}";

// The only formulas the export ever writes: a fixed function over a range the generator built itself.
const FORMULA_FUNCTION: Record<Aggregate, string> = { sum: "SUM", avg: "AVERAGE", count: "COUNTA", min: "MIN", max: "MAX" };

/** The fixed calculations offered for a field type: the grid's own list, limited to the kinds a view can store. */
export function calcsFor(type: FieldType): Aggregate[] {
  return totalOptions(type).filter(isAggregate);
}

interface SummaryCellInput {
  calc: Aggregate;
  field: FieldDef;
  rows: readonly Row[];
  env: CellEnv;
}

type ResultCell = (result: TotalResult, input: SummaryCellInput) => ExportCell;
const number: ResultCell = (result) => ("value" in result ? { value: Number(result.value), text: String(result.value) } : EMPTY_CELL);

const AS_CELL: Record<TotalResult["as"], ResultCell> = {
  empty: () => EMPTY_CELL,
  // Amounts in several currencies have no honest total; say so instead of writing a false figure.
  mixed: (_result, { env }) => {
    const text = env.t("export.summary.mixed");
    return { value: text, text };
  },
  field: (result, { field, env }) => {
    if (result.as !== "field") return EMPTY_CELL;
    const row: Row = { [field.key]: result.value };
    if (field.currencyKey && result.currency) row[field.currencyKey] = result.currency;
    return exportCell(field, row, env);
  },
  number,
  percent: number,
  days: number,
  list: () => EMPTY_CELL,
};

/** One calculation as a file cell, from the same routine as the on-screen totals row, so file and screen agree. */
export function summaryCell(input: SummaryCellInput): ExportCell {
  const result = computeTotal({ rows: input.rows, field: input.field, kind: input.calc });
  return AS_CELL[result.as](result, input);
}

/** A live formula is only right when the calculated value is a real number or date. */
export const canBeFormula = (cell: ExportCell): cell is ExportCell & { value: number | Date } =>
  typeof cell.value === "number" || cell.value instanceof Date;

export function summaryFormula(calc: Aggregate, range: string): string {
  return `${FORMULA_FUNCTION[calc]}(${range})`;
}

/** `{{total}}` in the label stands for the number of exported rows. */
export function summaryLabel(label: string, total: number): string {
  return label.replaceAll(TOTAL_TOKEN, String(total));
}
