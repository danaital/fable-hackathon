import type { CellValue, FieldDef, FieldType, Row } from "@/data/types";
import { getConversion, summarizeCurrency } from "@/features/currency/convert";
import { AGGREGATES, type Aggregate } from "@/features/report/viewState";
import { amountCurrency } from "./currencyHook";

/** Calculations the shared `Aggregate` type cannot name yet; the grid keeps these in its own preferences. */
export const EXTRA_KINDS = [
  "median",
  "mode",
  "range",
  "variance",
  "stdDev",
  "p25",
  "p75",
  "p90",
  "uniqueCount",
  "first",
  "last",
  "dateRangeDays",
  "countToday",
  "countPast",
  "countFuture",
  "countTrue",
  "countFalse",
  "percentTrue",
  "mostCommon",
  "leastCommon",
  "concat",
] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];
export type TotalKind = Aggregate | ExtraKind;

export const isAggregate = (kind: TotalKind): kind is Aggregate => AGGREGATES.some((aggregate) => aggregate === kind);

type Family = "numeric" | "date" | "boolean" | "text" | "other";
const FAMILY: Record<FieldType, Family> = {
  number: "numeric",
  currency: "numeric",
  percent: "numeric",
  date: "date",
  datetime: "date",
  boolean: "boolean",
  string: "text",
  enum: "text",
  status: "text",
  country: "text",
  email: "other",
};
const numericKinds: readonly TotalKind[] = ["sum", "avg", "count", "max", "min", "median", "mode", "range", "variance", "stdDev"];
const OPTIONS: Record<Family, readonly TotalKind[]> = {
  numeric: [...numericKinds, "p25", "p75", "p90", "uniqueCount", "first", "last"],
  date: ["min", "max", "dateRangeDays", "countToday", "countPast", "countFuture", "count", "uniqueCount", "first", "last"],
  boolean: ["countTrue", "countFalse", "percentTrue", "count", "first", "last"],
  text: ["mostCommon", "leastCommon", "uniqueCount", "count", "first", "last", "concat"],
  other: ["count", "uniqueCount", "first", "last", "mostCommon"],
};

/** The calculations offered for a field type, in menu order. "None" is the absence of a choice. */
export const totalOptions = (type: FieldType): readonly TotalKind[] => OPTIONS[FAMILY[type]];

type Present = Exclude<CellValue, null>;
export type TotalResult =
  | { as: "field"; value: Present; currency?: string }
  | { as: "number" | "percent" | "days"; value: number }
  | { as: "list"; values: Present[]; more: number }
  | { as: "mixed" }
  | { as: "empty" };

const DAY_MS = 86_400_000;
const DATE_ONLY_LENGTH = 10;
const CONCAT_LIMIT = 5;
const PERCENT = 100;
// Adding, averaging or ranking amounts across currencies would give a false figure.
const NEEDS_ONE_CURRENCY: ReadonlySet<TotalKind> = new Set([...numericKinds.filter((kind) => kind !== "count"), "p25", "p75", "p90"]);

interface Point {
  value: Present;
  /** The value as a number: the amount, or the instant for dates. */
  n: number;
  row: Row;
}
interface Calc {
  /** Number of rows being totalled, with or without a value. */
  total: number;
  points: Point[];
  numeric: Point[];
  isDate: boolean;
  now: Date;
  currencyOf: (row: Row) => string | undefined;
}

// A date without a time is read as local midnight, so "today" follows the user's calendar day.
const toInstant = (text: string) => Date.parse(text.length === DATE_ONLY_LENGTH ? `${text}T00:00` : text);
const toNumber = (value: Present) => (typeof value === "string" ? Number.parseFloat(value) : Number(value));
const numbers = ({ numeric }: Calc) => numeric.map((point) => point.n);
const sum = (list: readonly number[]) => list.reduce((total, n) => total + n, 0);
const mean = (list: readonly number[]) => sum(list) / list.length;
// Population variance: the rows on screen are the whole set, not a sample.
const variance = (list: readonly number[]) => mean(list.map((n) => (n - mean(list)) ** 2));

function percentile(list: readonly number[], p: number): number {
  const sorted = [...list].sort((a, b) => a - b);
  const rank = (p / PERCENT) * (sorted.length - 1);
  const low = Math.floor(rank);
  return sorted[low] + (sorted[Math.ceil(rank)] - sorted[low]) * (rank - low);
}

function byFrequency(points: readonly Point[]): { point: Point; count: number }[] {
  const seen = new Map<string, { point: Point; count: number }>();
  for (const point of points) {
    const entry = seen.get(String(point.value));
    if (entry) entry.count += 1;
    else seen.set(String(point.value), { point, count: 1 });
  }
  return [...seen.values()];
}

const empty: TotalResult = { as: "empty" };
const count = (value: number): TotalResult => ({ as: "number", value });
const ofPoint = (calc: Calc, point: Point | undefined): TotalResult =>
  point ? { as: "field", value: point.value, currency: calc.currencyOf(point.row) } : empty;
const ofNumber = (calc: Calc, value: number): TotalResult =>
  calc.numeric.length > 0 ? { as: "field", value, currency: calc.currencyOf(calc.numeric[0].row) } : empty;
const extreme = (calc: Calc, sign: 1 | -1) =>
  ofPoint(
    calc,
    calc.numeric.reduce<Point | undefined>((best, point) => (!best || (point.n - best.n) * sign > 0 ? point : best), undefined),
  );
const mostFrequent = (calc: Calc, sign: 1 | -1) =>
  ofPoint(
    calc,
    byFrequency(calc.points).reduce<{ point: Point; count: number } | undefined>(
      (best, entry) => (!best || (entry.count - best.count) * sign > 0 ? entry : best),
      undefined,
    )?.point,
  );
const dayStart = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
const dayEnd = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
const TRUE_VALUES: ReadonlySet<Present> = new Set([true, "true", 1, "1"]);
const FALSE_VALUES: ReadonlySet<Present> = new Set([false, "false", 0, "0"]);
const countOf = (calc: Calc, values: ReadonlySet<Present>) => calc.points.filter((point) => values.has(point.value)).length;
const countWhere = (calc: Calc, test: (n: number) => boolean) => count(numbers(calc).filter(test).length);

const CALCULATORS: Record<TotalKind, (calc: Calc) => TotalResult> = {
  sum: (calc) => ofNumber(calc, sum(numbers(calc))),
  avg: (calc) => ofNumber(calc, mean(numbers(calc))),
  count: (calc) => count(calc.total),
  min: (calc) => extreme(calc, -1),
  max: (calc) => extreme(calc, 1),
  median: (calc) => ofNumber(calc, percentile(numbers(calc), 50)),
  mode: (calc) => mostFrequent({ ...calc, points: calc.numeric }, 1),
  range: (calc) => ofNumber(calc, Math.max(...numbers(calc)) - Math.min(...numbers(calc))),
  // Variance is in squared units, so it is shown as a plain number, not as money or a percentage.
  variance: (calc) => (calc.numeric.length > 0 ? count(variance(numbers(calc))) : empty),
  stdDev: (calc) => ofNumber(calc, Math.sqrt(variance(numbers(calc)))),
  p25: (calc) => ofNumber(calc, percentile(numbers(calc), 25)),
  p75: (calc) => ofNumber(calc, percentile(numbers(calc), 75)),
  p90: (calc) => ofNumber(calc, percentile(numbers(calc), 90)),
  uniqueCount: (calc) => count(byFrequency(calc.points).length),
  first: (calc) => ofPoint(calc, calc.points[0]),
  last: (calc) => ofPoint(calc, calc.points.at(-1)),
  dateRangeDays: (calc) =>
    calc.numeric.length > 0 ? { as: "days", value: Math.round((Math.max(...numbers(calc)) - Math.min(...numbers(calc))) / DAY_MS) } : empty,
  countToday: (calc) => countWhere(calc, (n) => n >= dayStart(calc.now) && n < dayEnd(calc.now)),
  countPast: (calc) => countWhere(calc, (n) => n < dayStart(calc.now)),
  countFuture: (calc) => countWhere(calc, (n) => n >= dayEnd(calc.now)),
  countTrue: (calc) => count(countOf(calc, TRUE_VALUES)),
  countFalse: (calc) => count(countOf(calc, FALSE_VALUES)),
  percentTrue: (calc) => (calc.total > 0 ? { as: "percent", value: (countOf(calc, TRUE_VALUES) / calc.total) * PERCENT } : empty),
  mostCommon: (calc) => mostFrequent(calc, 1),
  leastCommon: (calc) => mostFrequent(calc, -1),
  concat: (calc) => {
    const unique = byFrequency(calc.points).map((entry) => entry.point.value);
    return unique.length > 0 ? { as: "list", values: unique.slice(0, CONCAT_LIMIT), more: Math.max(0, unique.length - CONCAT_LIMIT) } : empty;
  },
};

interface TotalInput {
  /** The rows the total covers: the whole filtered set, or one group. Never a single page. */
  rows: readonly Row[];
  field: FieldDef;
  kind: TotalKind;
  /** "Now" for the today, past and future counts; injectable so tests are stable. */
  now?: Date;
}

/**
 * One total. Missing and blank values are left out of every calculation except "count", which counts rows.
 * Amounts in several currencies give "mixed", and a failed conversion gives "empty": never a false figure.
 */
export function computeTotal({ rows, field, kind, now = new Date() }: TotalInput): TotalResult {
  const isDate = FAMILY[field.type] === "date";
  const points = rows.flatMap((row): Point[] => {
    const value = row[field.key] ?? null;
    if (value === null || value === "") return [];
    return [{ value, row, n: isDate ? toInstant(String(value)) : toNumber(value) }];
  });
  const numeric = points.filter((point) => !Number.isNaN(point.n)).map((point) => (isDate ? point : { ...point, value: point.n }));
  const currencyOf = (row: Row) => (field.type === "currency" ? amountCurrency(field, row) : undefined);

  if (field.type === "currency" && NEEDS_ONE_CURRENCY.has(kind)) {
    // A row whose conversion failed kept its own currency: no partial total, the cell stays empty.
    if (rows.some((row) => getConversion(row, field.key)?.missingRate)) return { as: "empty" };
    if (summarizeCurrency({ rows, field }).status === "mixed") return { as: "mixed" };
  }
  return CALCULATORS[kind]({ total: rows.length, points, numeric, isDate, now, currencyOf });
}

const SUMMED_TYPES: ReadonlySet<FieldType> = new Set(["number", "currency"]);

/** The totals a report shows before the user chooses any: a row count in the first column, a sum for amounts and numbers. */
export function defaultTotals(fields: readonly FieldDef[]): Record<string, Aggregate> {
  const totals: Record<string, Aggregate> = {};
  fields.forEach((field, index) => {
    if (SUMMED_TYPES.has(field.type)) totals[field.key] = "sum";
    else if (index === 0) totals[field.key] = "count";
  });
  return totals;
}

interface KindsInput {
  fields: readonly FieldDef[];
  /** `view.totals`. */
  totals: Readonly<Record<string, Aggregate>>;
  /** The grid's own choices for calculations `view.totals` cannot name; they win over `totals`. */
  extra: Readonly<Record<string, ExtraKind>>;
}

/** The calculation in force per field. A choice the field's type does not offer is ignored. */
export function totalKinds({ fields, totals, extra }: KindsInput): Record<string, TotalKind> {
  const kinds: Record<string, TotalKind> = {};
  for (const field of fields) {
    const kind: TotalKind | undefined = extra[field.key] ?? totals[field.key];
    if (kind && totalOptions(field.type).includes(kind)) kinds[field.key] = kind;
  }
  return kinds;
}

/** Index of the first column with no calculation, where the "Total" label sits; -1 when every column is calculated. */
export function labelColumn(fields: readonly FieldDef[], kinds: Readonly<Record<string, TotalKind>>): number {
  return fields.findIndex((field) => !(field.key in kinds));
}
