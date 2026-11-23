"use client";

import { Check, Circle, Clock, Minus, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";
import { Badge, Chip, Link, Ltr, VisuallyHidden } from "@/components/ui";
import { FIELD_TYPES, type CellValue, type FieldDef, type FieldType, type Row } from "@/data/types";
import { CurrencyAmount } from "@/features/currency/CurrencyAmount";
import type { I18nKey } from "@/i18n";
import type { Formatters } from "@/lib/format";
import { logger } from "@/lib/logger";
import type { ToneName } from "@/styles/theme";
import { amountCurrency } from "./currencyHook";
import { Inline, Mark, Muted, Plain, Time, TruncText, Upper } from "./parts";

const ICON_SIZE = 14;
const EMPTY_MARK = "—";
/** Text longer than this is cut with an ellipsis and becomes focusable, so the keyboard can reveal it. */
const TRUNCATE_CHARS = 32;
const ISO_COUNTRY = /^[A-Za-z]{2}$/;
const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - "A".charCodeAt(0);
const TRUE_TEXT: ReadonlySet<string> = new Set(["true", "1", "yes"]);
const FALSE_TEXT: ReadonlySet<string> = new Set(["false", "0", "no"]);
const emailSchema = z.email();

export interface CellContext {
  field: FieldDef;
  row: Row;
  format: Formatters;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
  tData: (prefix: string, value: string) => string;
  /** The search term to mark in text cells. The caller leaves it out until it reaches the minimum search length. */
  search?: string;
}

type Present = Exclude<CellValue, null>;
type Renderer = (value: Present, context: CellContext) => ReactNode;

// One generic icon per tone, so a new status value needs a tone in the field definition and no code.
const TONE_ICON: Record<ToneName, LucideIcon> = { success: Check, warning: Clock, danger: X, info: Circle, neutral: Minus };

const noValue = ({ t }: Pick<CellContext, "t">) => (
  <Muted>
    <VisuallyHidden>{t("value.empty")}</VisuallyHidden>
    <Plain aria-hidden>{EMPTY_MARK}</Plain>
  </Muted>
);

// Stored values are matched exactly first, then without regard to case, spaces, hyphens or underscores.
const loose = (value: string) => value.toLowerCase().replace(/[\s_-]/g, "");
function canonical(value: Present, { options }: FieldDef): string {
  const raw = String(value);
  return options?.find((option) => option === raw) ?? options?.find((option) => loose(option) === loose(raw)) ?? raw;
}
const label = (value: Present, { field, tData }: Pick<CellContext, "field" | "tData">) => {
  const key = canonical(value, field);
  return field.optionPrefix ? tData(field.optionPrefix, key) : key;
};
const countryName = (value: Present, format: Formatters) => {
  const code = String(value);
  return ISO_COUNTRY.test(code) ? format.country(code.toUpperCase()) : code;
};
const flagOf = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((letter) => letter.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET));
const toNumber = (value: Present) => (typeof value === "string" ? Number.parseFloat(value) : Number(value));

/** Loose boolean input: true/1/"yes" and false/0/"no" in any case; anything else is unknown, never "No". */
export function toBoolean(value: CellValue): boolean | null {
  const text = String(value).trim().toLowerCase();
  if (TRUE_TEXT.has(text)) return true;
  return FALSE_TEXT.has(text) ? false : null;
}

function highlight(text: string, search = ""): ReactNode {
  const term = search.trim();
  const index = term === "" ? -1 : text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return text;
  const end = index + term.length;
  return (
    <>
      {text.slice(0, index)}
      <Mark>{text.slice(index, end)}</Mark>
      {highlight(text.slice(end), search)}
    </>
  );
}

// Free text takes its own direction (dir="auto"): names and notes can be Hebrew, English or mixed.
const plainText = (text: string, { search }: CellContext) =>
  text.length > TRUNCATE_CHARS ? (
    <TruncText tabIndex={0} title={text} dir="auto">
      {highlight(text, search)}
    </TruncText>
  ) : (
    <Plain dir="auto">{highlight(text, search)}</Plain>
  );

function asNumber(pick: (format: Formatters) => (value: number) => string): Renderer {
  return function numberCell(value, context) {
    const number = toNumber(value);
    return Number.isNaN(number) ? noValue(context) : <Ltr>{pick(context.format)(number)}</Ltr>;
  };
}

// Dates follow the page direction: a Hebrew date has a Hebrew month name and reads right to left.
function asDate(pick: (format: Formatters) => (iso: string) => string): Renderer {
  return function dateCell(value, context) {
    const iso = String(value);
    return Number.isNaN(Date.parse(iso)) ? noValue(context) : <Time dateTime={iso}>{pick(context.format)(iso)}</Time>;
  };
}

// The code column can hold free text; Intl throws on anything that is not a currency code.
function isCurrencyCode(code: string, format: Formatters): boolean {
  try {
    format.currency(0, code);
    return true;
  } catch {
    return false;
  }
}

/** One renderer per field type. A field can name any of these as its `cellTemplate` to override its type's renderer. */
const RENDERERS: Record<FieldType, Renderer> = {
  string: (value, context) => plainText(String(value), context),
  enum: (value, context) => (
    <Chip>
      <Upper>{highlight(label(value, context), context.search)}</Upper>
    </Chip>
  ),
  number: asNumber((format) => format.number),
  percent: asNumber((format) => format.percent),
  // CURRENCY HOOK: the grid's single wiring point to the currency feature. CurrencyAmount owns the display modes
  // and the "converted" and "no rate" markers; it needs CurrencyProvider above the grid.
  currency: (value, { field, row, format, ...context }) => {
    const amount = toNumber(value);
    if (Number.isNaN(amount)) return noValue(context);
    const code = amountCurrency(field, row);
    // A bad code is printed beside the number instead of crashing the cell.
    if (code && !isCurrencyCode(code, format)) return <Ltr>{`${code} ${format.number(amount)}`}</Ltr>;
    return <CurrencyAmount row={row} field={field} format={format} />;
  },
  date: asDate((format) => format.date),
  datetime: asDate((format) => format.dateTime),
  boolean: (value, context) => {
    const flag = toBoolean(value);
    if (flag === null) return noValue(context);
    const Icon = flag ? Check : X;
    return (
      <Badge $tone={flag ? "success" : "neutral"}>
        <Icon size={ICON_SIZE} aria-hidden />
        {context.t(flag ? "bool.yes" : "bool.no")}
      </Badge>
    );
  },
  status: (value, context) => {
    // The tone comes from the stored value, never from the translated label, so it is the same in both languages.
    const tone = context.field.optionTones?.[canonical(value, context.field)] ?? "neutral";
    const Icon = TONE_ICON[tone];
    return (
      <Badge $tone={tone}>
        <Icon size={ICON_SIZE} aria-hidden />
        <Upper>{highlight(label(value, context), context.search)}</Upper>
      </Badge>
    );
  },
  country: (value, { format, search }) => {
    const code = String(value);
    return (
      <Inline>
        {ISO_COUNTRY.test(code) ? <Plain aria-hidden>{flagOf(code)}</Plain> : <Badge aria-hidden>{code.slice(0, 2).toUpperCase()}</Badge>}
        <Plain dir="auto">{highlight(countryName(value, format), search)}</Plain>
      </Inline>
    );
  },
  email: (value, context) => {
    const address = String(value).trim();
    if (!emailSchema.safeParse(address).success) return noValue(context);
    const name = context.t("gridx.cell.email", { value: address });
    return (
      <Link href={`mailto:${address}`} aria-label={name} title={name}>
        <Ltr>{highlight(address, context.search)}</Ltr>
      </Link>
    );
  },
};

const warnedTemplates = new Set<string>();

/** Named template first, then the field type, then plain text: an unknown name or type never breaks the grid. */
function rendererFor(field: FieldDef): Renderer {
  const byType: Renderer = RENDERERS[field.type] ?? RENDERERS.string;
  // FieldDef has no `cellTemplate` yet; it is read when present so the override works once the shared type gains it.
  const template = "cellTemplate" in field ? field.cellTemplate : undefined;
  if (template === undefined) return byType;
  const known = FIELD_TYPES.find((type) => type === template);
  if (known) return RENDERERS[known];
  if (!warnedTemplates.has(field.key)) {
    warnedTemplates.add(field.key);
    logger.warn("unknown cell template, using the field type renderer", { field: field.key });
  }
  return byType;
}

export const END_ALIGNED: ReadonlySet<FieldType> = new Set(["number", "currency", "percent"]);

export function renderCell(value: CellValue | undefined, context: CellContext): ReactNode {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return noValue(context);
  return rendererFor(context.field)(value, context);
}

/** Plain text of a cell, used by search so it matches what the user reads. */
export function cellText(value: CellValue | undefined, context: CellContext): string {
  if (value === null || value === undefined) return "";
  const { field, format } = context;
  if (field.type === "country") return countryName(value, format);
  if (field.optionPrefix) return label(value, context);
  return String(value);
}

/** Text of a value where an empty cell must still say something: group headings and value lists. */
export function displayText(value: CellValue, context: CellContext): string {
  if (value === null) return context.t("value.empty");
  if (value === "") return context.t("gridx.emptyValue");
  const flag = context.field.type === "boolean" ? toBoolean(value) : null;
  if (flag !== null) return context.t(flag ? "bool.yes" : "bool.no");
  return cellText(value, context);
}
