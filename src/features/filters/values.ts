import type { CellValue } from "@/data/types";

/** How filter values and cells are read: as numbers, booleans, calendar days or instants. */

const SECOND_MS = 1000;
export const DAY_MS = 86_400_000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
// Only ISO-shaped text is read as a date; the platform parser would also accept text such as "A-10000".
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const TRUE_VALUES: ReadonlySet<CellValue> = new Set<CellValue>([true, "true", 1, "1"]);
const FALSE_VALUES: ReadonlySet<CellValue> = new Set<CellValue>([false, "false", 0, "0"]);

export type Point = (value: CellValue | undefined) => number;

/** An empty cell has no value at all. `0`, `false` and text made of spaces are values. */
export const isEmptyCell = (value: CellValue | undefined): boolean => value === null || value === undefined || value === "";

export const lower = (value: CellValue | undefined): string => String(value ?? "").toLowerCase();

/** `NaN` when the value is not a number. */
export const toNumber: Point = (value) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || value.trim() === "") return Number.NaN;
  return Number(value);
};

/** `null` when the value does not look like a yes/no value. */
export function toBool(value: CellValue | undefined): boolean | null {
  if (value === undefined) return null;
  if (TRUE_VALUES.has(value)) return true;
  return FALSE_VALUES.has(value) ? false : null;
}

export interface ParsedDate {
  date: Date;
  /** The text had no time of day, so it stands for the whole local day. */
  dayOnly: boolean;
}

export function parseDate(value: CellValue | undefined): ParsedDate | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const day = DATE_ONLY.exec(text);
  if (day) return { date: new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])), dayOnly: true };
  if (!ISO_DATE_TIME.test(text)) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : { date, dayOnly: false };
}

/** Local midnight of the value's calendar day, so two values on the same day compare equal. */
export const dayPoint: Point = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return Number.NaN;
  const { date } = parsed;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

/** The instant in whole seconds. A value without a time is the start of its day, or the end when `endOfDay` is set. */
export const instantPoint =
  (endOfDay: boolean): Point =>
  (value) => {
    const parsed = parseDate(value);
    if (!parsed) return Number.NaN;
    const { date, dayOnly } = parsed;
    const at = dayOnly && endOfDay ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59) : date;
    return Math.floor(at.getTime() / SECOND_MS);
  };
