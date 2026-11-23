import type { CellValue, FieldDef, FieldType, Row } from "@/data/types";
import { cellText } from "@/features/grid/cells";
import type { Formatters } from "@/lib/format";
import type { FormattingSettings } from "./schema";
import type { Translate, TranslateData } from "./translate";

export interface ExportCell {
  /** What a spreadsheet stores: a real number or date where the field type allows, otherwise text. */
  value: string | number | Date | null;
  /** Excel number format for `value`. */
  numFmt?: string;
  /** What a text file shows. */
  text: string;
}

export interface CellEnv {
  format: Formatters;
  t: Translate;
  tData: TranslateData;
  formatting: FormattingSettings;
}

interface ConvertInput {
  value: Exclude<CellValue, null>;
  field: FieldDef;
  row: Row;
  env: CellEnv;
}

type DatePart = "dd" | "mm" | "yyyy";
const DATE_PARTS: Record<FormattingSettings["dateOrder"], readonly DatePart[]> = {
  dmy: ["dd", "mm", "yyyy"],
  mdy: ["mm", "dd", "yyyy"],
  ymd: ["yyyy", "mm", "dd"],
};
const TIME_PATTERN: Record<FormattingSettings["timeFormat"], string> = { "24h": "hh:mm", "12h": "hh:mm AM/PM" };
const AUTO_DECIMALS: Record<"currency" | "percent" | "fraction", number> = { currency: 2, percent: 1, fraction: 2 };
const PERCENT_SCALE = 100;
const NOON = 12;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const CURRENCY_CODE = /^[A-Z]{3}$/;
export const EMPTY_CELL: ExportCell = { value: null, text: "" };

const pad = (n: number) => String(n).padStart(2, "0");
const text = (value: string): ExportCell => ({ value, text: value });

export function datePattern({ dateOrder, dateDelimiter }: FormattingSettings): string {
  return DATE_PARTS[dateOrder].join(dateDelimiter);
}

export function dateTimePattern(formatting: FormattingSettings): string {
  const parts = [datePattern(formatting), TIME_PATTERN[formatting.timeFormat]];
  return (formatting.dateTimeStructure === "date_time" ? parts : parts.reverse()).join(" ");
}

/** Excel pattern for a number, e.g. `#,##0.00`. */
export function numberPattern(decimals: number, thousands: boolean): string {
  return `${thousands ? "#,##0" : "0"}${decimals > 0 ? `.${"0".repeat(decimals)}` : ""}`;
}

/** Decimal places for a value: the chosen number, or a sensible one per kind when the choice is "auto". */
export function decimalsFor(kind: keyof typeof AUTO_DECIMALS, { decimals }: FormattingSettings, value: number): number {
  if (decimals !== "auto") return Number(decimals);
  return kind === "fraction" && Number.isInteger(value) ? 0 : AUTO_DECIMALS[kind];
}

function dateText(date: Date, formatting: FormattingSettings): string {
  const parts: Record<DatePart, string> = {
    dd: pad(date.getUTCDate()),
    mm: pad(date.getUTCMonth() + 1),
    yyyy: String(date.getUTCFullYear()),
  };
  return DATE_PARTS[formatting.dateOrder].map((part) => parts[part]).join(formatting.dateDelimiter);
}

function timeText(date: Date, { timeFormat }: FormattingSettings): string {
  const hours = date.getUTCHours();
  const minutes = pad(date.getUTCMinutes());
  if (timeFormat === "24h") return `${pad(hours)}:${minutes}`;
  return `${pad(hours % NOON || NOON)}:${minutes} ${hours < NOON ? "AM" : "PM"}`;
}

const label = ({ value, field, row, env }: ConvertInput): ExportCell =>
  text(cellText(value, { field, row, format: env.format, t: env.t, tData: env.tData }));

function numeric(input: ConvertInput, build: (n: number) => ExportCell): ExportCell {
  const n = typeof input.value === "number" ? input.value : Number(input.value);
  return Number.isFinite(n) ? build(n) : text(String(input.value));
}

function currencyText(amount: number, code: string | undefined, format: Formatters): string {
  try {
    return format.currency(amount, code);
  } catch {
    return `${code ?? ""} ${format.number(amount)}`.trim(); // a malformed currency code must not fail the export
  }
}

const CONVERTERS: Record<FieldType, (input: ConvertInput) => ExportCell> = {
  string: ({ value }) => text(String(value)),
  email: ({ value }) => text(String(value)),
  enum: label,
  status: label,
  country: label,
  boolean: ({ value, env }) => text(env.t(value === true || value === "true" ? "bool.yes" : "bool.no")),
  number: (input) =>
    numeric(input, (n) => ({
      value: n,
      numFmt: numberPattern(decimalsFor("fraction", input.env.formatting, n), input.env.formatting.thousands),
      text: String(n),
    })),
  currency: (input) =>
    numeric(input, (n) => {
      const { field, row, env } = input;
      const raw = field.currencyKey ? row[field.currencyKey] : null;
      const code = typeof raw === "string" ? raw : undefined;
      const pattern = numberPattern(decimalsFor("currency", env.formatting, n), env.formatting.thousands);
      // Only a plain ISO code goes into the pattern; anything else could break out of the quoted literal.
      const numFmt = code && CURRENCY_CODE.test(code) ? `${pattern} "${code}"` : pattern;
      return { value: n, numFmt, text: currencyText(n, code, env.format) };
    }),
  // Percent values are stored as whole numbers (15 means 15%); a spreadsheet percent cell stores 0.15.
  percent: (input) =>
    numeric(input, (n) => ({
      value: n / PERCENT_SCALE,
      numFmt: `${numberPattern(decimalsFor("percent", input.env.formatting, n), false)}%`,
      text: input.env.format.percent(n),
    })),
  date: ({ value, env }) => {
    const match = ISO_DATE.exec(String(value));
    if (!match) return text(String(value));
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return { value: date, numFmt: datePattern(env.formatting), text: dateText(date, env.formatting) };
  },
  datetime: ({ value, env }) => {
    const local = new Date(String(value));
    if (Number.isNaN(local.getTime())) return text(String(value));
    // Spreadsheets have no time zone: store the wall-clock time the user sees on screen.
    const wall = new Date(
      Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), local.getHours(), local.getMinutes(), local.getSeconds()),
    );
    const parts = [dateText(wall, env.formatting), timeText(wall, env.formatting)];
    const ordered = env.formatting.dateTimeStructure === "date_time" ? parts : parts.reverse();
    return { value: wall, numFmt: dateTimePattern(env.formatting), text: ordered.join(" ") };
  },
};

/** One cell of the file, typed by its field. Null, empty and non-finite values are blank. */
export function exportCell(field: FieldDef, row: Row, env: CellEnv): ExportCell {
  const value = row[field.key];
  if (value === null || value === undefined || value === "") return EMPTY_CELL;
  if (typeof value === "number" && !Number.isFinite(value)) return EMPTY_CELL;
  return CONVERTERS[field.type]({ value, field, row, env });
}
