import type { CellValue, FieldDef, Row } from "@/data/types";
import { summarizeCurrency } from "@/features/currency/convert";
import type { ConfigFilter } from "./config";

export type Rows = readonly Row[];
export type Fields = readonly FieldDef[];

/** How a calculated number is printed. */
export interface Unit {
  type: "number" | "percent" | "currency";
  currency?: string;
}
export interface Measure {
  value: number;
  unit: Unit;
}
export const PLAIN: Unit = { type: "number" };

export const NOTICE_CODES = ["mixedCurrency"] as const;
export type NoticeCode = (typeof NOTICE_CODES)[number];

/** Thrown by a calculation that must show a notice instead of a number (never a false total). */
export class SummaryNotice extends Error {
  constructor(
    readonly code: NoticeCode,
    readonly detail: string,
  ) {
    super(code);
  }
}

export const isBlank = (value: CellValue | undefined): value is null | undefined | "" =>
  value === null || value === undefined || value === "";

/** A cell as a number, or null when it holds no number (blank, text, boolean). */
export function toNumber(value: CellValue | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const FILTER_TESTS: Record<ConfigFilter["operator"], (hit: boolean) => boolean> = {
  in: (hit) => hit,
  notIn: (hit) => !hit,
};

/**
 * Config filters, combined with AND. A filter with no values is ignored; no match gives an empty set.
 * shortcut: only "in" and "notIn", matched exactly; move to the shared filter engine (all operators, preset periods) once its rule shape is stable.
 */
export function applyConfigFilters(rows: Rows, filters: readonly ConfigFilter[] | undefined): Rows {
  const active = (filters ?? []).filter((filter) => filter.values.length > 0);
  if (active.length === 0) return rows;
  return rows.filter((row) =>
    active.every(({ field, operator, values }) => FILTER_TESTS[operator](values.includes(row[field] ?? null))),
  );
}

interface ColumnInput {
  rows: Rows;
  key: string;
  fields: Fields;
}

/**
 * The numbers of one field, one entry per row (null where the row has no number), with the unit to print them in.
 * A currency field whose rows hold more than one currency throws the mixed-currency notice.
 * Conversion happens upstream: ReportProvider hands over rows already in the display currency, so rows only mix
 * currencies while no display currency is chosen. "Mixed" is judged by the currency feature's own rule.
 */
export function readColumn({ rows, key, fields }: ColumnInput): { numbers: (number | null)[]; unit: Unit } {
  const field = fields.find((candidate) => candidate.key === key);
  const numbers = rows.map((row) => toNumber(row[key]));
  if (field?.type !== "currency") return { numbers, unit: field?.type === "percent" ? { type: "percent" } : PLAIN };
  const summary = summarizeCurrency({ rows, field });
  if (summary.status === "mixed") throw new SummaryNotice("mixedCurrency", [...summary.currencies].sort().join(", "));
  return { numbers, unit: { type: "currency", currency: summary.currency ?? undefined } };
}
