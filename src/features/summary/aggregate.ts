import type { CellValue } from "@/data/types";
import type { Calculation } from "./config";
import { PLAIN, isBlank, readColumn, toNumber, type Fields, type Measure, type Rows } from "./values";

const numbersOf = (cells: readonly CellValue[]) => cells.flatMap((cell) => toNumber(cell) ?? []);
const sum = (numbers: readonly number[]) => numbers.reduce((total, n) => total + n, 0);

export function mean(numbers: readonly number[]): number {
  return numbers.length === 0 ? 0 : sum(numbers) / numbers.length;
}

function median(numbers: readonly number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * One calculation per kind, over the cells of one field (one cell per row).
 * Blank rule: sum counts a cell with no number as 0; average, median, minimum and maximum skip it; unique ignores blanks.
 */
export const CALCULATORS: Record<Calculation, (cells: readonly CellValue[]) => number> = {
  count: (cells) => cells.length,
  unique: (cells) => new Set(cells.filter((cell) => !isBlank(cell))).size,
  sum: (cells) => sum(numbersOf(cells)),
  average: (cells) => mean(numbersOf(cells)),
  averageRounded: (cells) => Math.round(mean(numbersOf(cells))),
  median: (cells) => median(numbersOf(cells)),
  minimum: (cells) => numbersOf(cells).reduce<number | null>((low, n) => (low === null || n < low ? n : low), null) ?? 0,
  maximum: (cells) => numbersOf(cells).reduce<number | null>((high, n) => (high === null || n > high ? n : high), null) ?? 0,
};

/** Kinds whose result is a number of rows or values, whatever the field's unit. */
export const COUNTING: ReadonlySet<Calculation> = new Set(["count", "unique"]);
export const AVERAGING: ReadonlySet<Calculation> = new Set(["average", "averageRounded"]);

interface MeasureInput {
  rows: Rows;
  calculation: Calculation;
  /** Field to calculate over. Count needs none; any other kind without a field gives 0. */
  key?: string;
  fields: Fields;
}

/** One number for a set of rows, with its unit. Throws the mixed-currency notice instead of totalling mixed money. */
export function measure({ rows, calculation, key, fields }: MeasureInput): Measure {
  if (calculation === "count") return { value: rows.length, unit: PLAIN };
  if (!key) return { value: 0, unit: PLAIN };
  if (calculation === "unique") return { value: CALCULATORS.unique(rows.map((row) => row[key] ?? null)), unit: PLAIN };
  const { numbers, unit } = readColumn({ rows, key, fields });
  return { value: CALCULATORS[calculation](numbers), unit };
}
