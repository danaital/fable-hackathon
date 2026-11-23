import type { CellValue, FieldDef, FieldType, Row } from "@/data/types";

export type SortDirection = "asc" | "desc";
export interface SortRule {
  key: string;
  direction: SortDirection;
}

type Present = Exclude<CellValue, null>;
type Comparator = (a: Present, b: Present) => number;
export type CellComparator = (a: CellValue | undefined, b: CellValue | undefined) => number;

const byText: Comparator = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
const toNumber = (value: Present) => (typeof value === "string" ? Number.parseFloat(value) : Number(value));
const toInstant = (value: Present) => Date.parse(String(value));

// Values that do not parse sort together at one end, after the missing ones and before every parsed value.
const byParsed =
  (parse: (value: Present) => number): Comparator =>
  (a, b) => {
    const [x, y] = [parse(a), parse(b)];
    if (Number.isNaN(x) || Number.isNaN(y)) return Number.isNaN(x) && Number.isNaN(y) ? byText(a, b) : Number(Number.isNaN(y)) - Number(Number.isNaN(x));
    return x - y;
  };
const byBoolean: Comparator = (a, b) => Number(a === true) - Number(b === true);

const COMPARATORS: Record<FieldType, Comparator> = {
  string: byText,
  email: byText,
  enum: byText,
  status: byText,
  country: byText,
  number: byParsed(toNumber),
  currency: byParsed(toNumber),
  percent: byParsed(toNumber),
  boolean: byBoolean,
  date: byParsed(toInstant),
  datetime: byParsed(toInstant),
};

/** Translated text of an option-like value (enum, status, country), so order follows what the user reads. */
export type LabelFor = (field: FieldDef, value: Present) => string;
const LABELLED_TYPES: ReadonlySet<FieldType> = new Set(["enum", "status", "country"]);

/** Type-aware compare. A missing value is smaller than everything; an empty string is a value, not a missing one. */
export function comparatorFor(field: FieldDef, labelFor?: LabelFor): CellComparator {
  const byType = COMPARATORS[field.type];
  const compare: Comparator =
    labelFor && LABELLED_TYPES.has(field.type) ? (a, b) => byText(labelFor(field, a), labelFor(field, b)) : byType;
  return (a, b) => {
    const [x, y] = [a ?? null, b ?? null];
    if (x === null || y === null) return Number(x !== null) - Number(y !== null);
    return compare(x, y);
  };
}

/**
 * Click cycle for a column header: ascending, then descending, then removed.
 * A new column joins the end of the priority chain; pass `keepOthers: false` to replace the chain instead.
 */
export function nextSortRules(rules: readonly SortRule[], key: string, keepOthers = true): SortRule[] {
  const current = rules.find((rule) => rule.key === key);
  const others = keepOthers ? rules.filter((rule) => rule.key !== key) : [];
  if (!current) return [...others, { key, direction: "asc" }];
  if (current.direction === "asc") {
    return keepOthers ? rules.map((rule) => (rule.key === key ? { key, direction: "desc" } : rule)) : [{ key, direction: "desc" }];
  }
  return others;
}

/**
 * Sorts by each rule in priority order. Missing values come first ascending and last descending.
 * Pass `labelFor` to order enum, status and country values by their translated label.
 */
export function sortRows(rows: readonly Row[], rules: readonly SortRule[], fields: readonly FieldDef[], labelFor?: LabelFor): Row[] {
  if (rules.length === 0) return [...rows];
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const active = rules.flatMap((rule) => {
    const field = byKey.get(rule.key);
    return field ? [{ key: rule.key, sign: rule.direction === "asc" ? 1 : -1, compare: comparatorFor(field, labelFor) }] : [];
  });

  return [...rows].sort((rowA, rowB) => {
    for (const { key, sign, compare } of active) {
      const result = compare(rowA[key], rowB[key]);
      if (result !== 0) return result * sign;
    }
    return 0;
  });
}
