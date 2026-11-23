import type { CellValue } from "@/data/types";
import { AVERAGING, CALCULATORS, COUNTING, mean, roundTo } from "./aggregate";
import type { Calculation } from "./config";
import { PLAIN, isBlank, readColumn, type Fields, type Rows, type Unit } from "./values";

export interface RankingRow {
  /** Raw group value; null is the group of rows with a blank label ("Unknown"). */
  key: string | null;
  value: number;
  /** 1-based place, highest value first. */
  position: number;
  /** Part of the total, 0 to 1. Null when shares are off or make no sense (averages, zero total). */
  share: number | null;
}

export interface RankingResult {
  /** Every group, best first. The card shows the first Top N. */
  rows: RankingRow[];
  summary: "total" | "average";
  summaryValue: number;
  unit: Unit;
}

const DECIMALS: Partial<Record<Calculation, number>> = { sum: 2, median: 1, average: 2 };

interface RankInput {
  rows: Rows;
  labelKey: string;
  /** Field to calculate per group. Absent: groups are ranked by their row count. */
  valueKey?: string;
  /** Absent: sum for a currency field, average for any other field. */
  calculation?: Calculation;
  fields: Fields;
  showShare?: boolean;
  mergeSuffixes?: readonly string[];
}

/** "Acme Retail" becomes "Acme" when "Retail" is a merge suffix. A label that is only the suffix stays as it is. */
function mergeLabel(label: string, suffixes: readonly string[]): string {
  const at = label.lastIndexOf(" ");
  return at > 0 && suffixes.includes(label.slice(at + 1)) ? label.slice(0, at) : label;
}

export function rank({ rows, labelKey, valueKey, calculation, fields, showShare, mergeSuffixes = [] }: RankInput): RankingResult {
  const isCurrency = fields.find((field) => field.key === valueKey)?.type === "currency";
  const kind: Calculation = !valueKey ? "count" : (calculation ?? (isCurrency ? "sum" : "average"));
  const counting = COUNTING.has(kind);
  // Counting kinds look at the raw cells; every other kind reads numbers (and refuses mixed currencies).
  const column = valueKey && !counting ? readColumn({ rows, key: valueKey, fields }) : null;
  const cells: readonly CellValue[] = column?.numbers ?? rows.map((row) => (valueKey ? (row[valueKey] ?? null) : null));

  const groups = new Map<string | null, CellValue[]>();
  rows.forEach((row, index) => {
    const label = row[labelKey];
    const key = isBlank(label) ? null : mergeLabel(String(label), mergeSuffixes);
    const group = groups.get(key);
    if (group) group.push(cells[index]);
    else groups.set(key, [cells[index]]);
  });

  const decimals = DECIMALS[kind];
  const values = [...groups].map(([key, group]) => {
    const value = CALCULATORS[kind](group);
    return { key, value: decimals === undefined ? value : roundTo(value, decimals) };
  });
  values.sort((a, b) => b.value - a.value || String(a.key).localeCompare(String(b.key)));

  const groupSum = values.reduce((total, group) => total + group.value, 0);
  const total = counting ? groupSum : CALCULATORS.sum(cells);
  const averaging = AVERAGING.has(kind);
  const withShare = Boolean(showShare) && !averaging && total > 0;

  return {
    rows: values.map((group, index) => ({ ...group, position: index + 1, share: withShare ? group.value / total : null })),
    summary: averaging ? "average" : "total",
    summaryValue: averaging ? mean(values.map((group) => group.value)) : total,
    unit: counting ? PLAIN : (column?.unit ?? PLAIN),
  };
}
