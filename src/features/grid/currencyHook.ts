import type { FieldDef, Row } from "@/data/types";

/**
 * The currency code an amount is in. Rows arrive already converted (ReportContext runs convertRows), so this is
 * the code stored on the row. Returns undefined when the field has no currency column.
 * Display modes and conversion markers are not decided here: the money cell hands over to CurrencyAmount (cells.tsx).
 */
export function amountCurrency(field: FieldDef, row: Row): string | undefined {
  const code = field.currencyKey ? row[field.currencyKey] : null;
  return typeof code === "string" && code !== "" ? code : undefined;
}
