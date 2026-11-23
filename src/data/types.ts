import type { I18nKey } from "@/i18n/en";
import type { ToneName } from "@/styles/theme";

export const FIELD_TYPES = [
  "string",
  "number",
  "currency",
  "percent",
  "date",
  "datetime",
  "boolean",
  "enum",
  "status",
  "country",
  "email",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type CellValue = string | number | boolean | null;
export type Row = Record<string, CellValue>;

export interface FieldDef {
  key: string;
  type: FieldType;
  labelKey: I18nKey;
  /** i18n prefix for enum and status values, e.g. "status" → "status.late". */
  optionPrefix?: string;
  options?: readonly string[];
  /** For status fields: badge tone per option value. Unlisted values use the neutral tone. */
  optionTones?: Readonly<Record<string, ToneName>>;
  /** For currency fields: the row field that holds the ISO currency code. */
  currencyKey?: string;
  /** A static money field is never converted: it always shows the row's own currency. */
  static?: boolean;
}

export const REPORT_ICONS = ["orders", "customers", "invoices", "shipments", "tickets", "products"] as const;
export type ReportIcon = (typeof REPORT_ICONS)[number];

export const TAGS = ["sales", "operations", "finance", "customers", "support", "inventory"] as const;
export type Tag = (typeof TAGS)[number];

export interface ReportDef {
  id: string;
  titleKey: I18nKey;
  descKey: I18nKey;
  icon: ReportIcon;
  tags: readonly Tag[];
  fields: readonly FieldDef[];
}
