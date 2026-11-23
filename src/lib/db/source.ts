import { REPORTS, getReport, getRows } from "@/data/reports";
import { CHANNELS, COUNTRIES, CURRENCIES, SEGMENTS, STATUSES } from "@/data/seed";
import {
  CARRIERS,
  CATEGORIES,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  PRIORITIES,
  SHIPMENT_STATUSES,
  STOCK_STATUSES,
  TICKET_CHANNELS,
  TICKET_STATUSES,
} from "@/data/seed-extra";
import type { FieldDef, Row } from "@/data/types";
import { en } from "@/i18n/en";
import { he } from "@/i18n/he";

// shortcut: one request returns at most this many rows, server-side paging and filtering replace the cap when datasets grow.
export const ROW_CAP = 50_000;

const DEFAULT_TONE = "neutral";

// The only relations a report id can read. Request input picks a key here and never becomes SQL.
const REPORT_VIEWS: ReadonlyMap<string, string> = new Map([
  ["orders", "reports.orders"],
  ["customers", "reports.customers"],
  ["invoices", "reports.invoices"],
  ["shipments", "reports.shipments"],
  ["tickets", "reports.tickets"],
  ["products", "reports.products"],
]);

// The primary database's lookup table for each option list of the generator.
const GENERATOR_LOOKUPS: ReadonlyMap<readonly string[], string> = new Map<readonly string[], string>([
  [STATUSES, "order_statuses"],
  [CHANNELS, "sales_channels"],
  [CURRENCIES, "currencies"],
  [COUNTRIES, "countries"],
  [SEGMENTS, "customer_segments"],
  [INVOICE_STATUSES, "invoice_statuses"],
  [PAYMENT_METHODS, "payment_methods"],
  [CARRIERS, "carriers"],
  [SHIPMENT_STATUSES, "shipment_statuses"],
  [TICKET_CHANNELS, "ticket_channels"],
  [PRIORITIES, "ticket_priorities"],
  [TICKET_STATUSES, "ticket_statuses"],
  [CATEGORIES, "product_categories"],
  [STOCK_STATUSES, "stock_statuses"],
]);

export interface Labels {
  en: string;
  he: string;
}

export interface CatalogueField {
  key: string;
  type: string;
  label: Labels;
  /** Name for GET /api/lookups/{table}; null when the field has no coded values. */
  lookup: string | null;
  currencyKey: string | null;
}

export interface CatalogueReport {
  id: string;
  icon: string;
  tags: string[];
  title: Labels;
  description: Labels;
  fields: CatalogueField[];
}

export interface LookupItem {
  code: string;
  label: Labels;
  tone: string;
  sortOrder: number;
}

export interface RowsBody {
  rows: Row[];
  truncated?: true;
}

/** One reports.report_fields row joined with its report and lookup table. */
export interface CatalogueRow {
  id: string;
  icon: string;
  tags: string[];
  title_en: string;
  title_he: string;
  desc_en: string;
  desc_he: string;
  key: string;
  type: string;
  label_en: string;
  label_he: string;
  currency_key: string | null;
  lookup_schema: string | null;
  lookup_table: string | null;
}

export interface LookupRow {
  code: string;
  label_en: string;
  label_he: string;
  tone: string;
  sort_order: number;
}

/** The database reads. Routes pass the Postgres ones, or null to use the generator; tests inject fakes. */
export interface Queries {
  catalogue: () => Promise<CatalogueRow[]>;
  rows: (query: { view: string; columns: string[]; limit: number }) => Promise<Row[]>;
  lookup: (table: string) => Promise<LookupRow[]>;
}

const MESSAGES: { en: Record<string, string>; he: Record<string, string> } = { en, he };
const REGION_NAMES = {
  en: new Intl.DisplayNames(["en"], { type: "region" }),
  he: new Intl.DisplayNames(["he"], { type: "region" }),
};

const message = (key: string, fallback: string): Labels => ({ en: MESSAGES.en[key] ?? fallback, he: MESSAGES.he[key] ?? fallback });

const optionsOf = (field: FieldDef): readonly string[] => field.options ?? (field.type === "country" ? COUNTRIES : []);
const lookupOf = (field: FieldDef): string | null => GENERATOR_LOOKUPS.get(optionsOf(field)) ?? null;

function optionLabel(field: FieldDef, code: string): Labels {
  if (field.type === "country") return { en: REGION_NAMES.en.of(code) ?? code, he: REGION_NAMES.he.of(code) ?? code };
  // Options without an i18n prefix (currencies) show their code, as the grid does.
  return field.optionPrefix ? message(`${field.optionPrefix}.${code}`, code) : { en: code, he: code };
}

function generatorCatalogue(): CatalogueReport[] {
  return REPORTS.map((report) => ({
    id: report.id,
    icon: report.icon,
    tags: [...report.tags],
    title: message(report.titleKey, report.id),
    description: message(report.descKey, ""),
    fields: report.fields.map((field) => ({
      key: field.key,
      type: field.type,
      label: message(field.labelKey, field.key),
      lookup: lookupOf(field),
      currencyKey: field.currencyKey ?? null,
    })),
  }));
}

function generatorLookup(table: string): LookupItem[] | undefined {
  const field = REPORTS.flatMap((report) => report.fields).find((candidate) => lookupOf(candidate) === table);
  return field && optionsOf(field).map((code, index) => ({
    code,
    label: optionLabel(field, code),
    tone: field.optionTones?.[code] ?? DEFAULT_TONE,
    sortOrder: index + 1,
  }));
}

const capRows = (rows: Row[]): RowsBody => (rows.length > ROW_CAP ? { rows: rows.slice(0, ROW_CAP), truncated: true } : { rows });

/** The report catalogue with fields. It never carries a row count. */
export async function getCatalogue(queries: Queries | null): Promise<CatalogueReport[]> {
  if (!queries) return generatorCatalogue();
  const reports = new Map<string, CatalogueReport>();
  for (const row of await queries.catalogue()) {
    const report = reports.get(row.id) ?? {
      id: row.id,
      icon: row.icon,
      tags: row.tags,
      title: { en: row.title_en, he: row.title_he },
      description: { en: row.desc_en, he: row.desc_he },
      fields: [],
    };
    report.fields.push({
      key: row.key,
      type: row.type,
      label: { en: row.label_en, he: row.label_he },
      lookup: row.lookup_table,
      currencyKey: row.currency_key,
    });
    reports.set(row.id, report);
  }
  return [...reports.values()];
}

/** Rows of a known report, or undefined when the id is not a report. */
export async function getReportRows(id: string, queries: Queries | null): Promise<RowsBody | undefined> {
  if (!queries) {
    // getReport first: a bare object lookup would also match inherited keys such as "constructor".
    const rows = getReport(id) && getRows(id);
    return rows && capRows(rows);
  }
  const view = REPORT_VIEWS.get(id);
  const fields = (await queries.catalogue()).filter((row) => row.id === id);
  if (!view || fields.length === 0) return undefined;
  // A currency field needs the column that holds its currency code, even when that column is not a field itself.
  const columns = [...new Set([...fields.map((row) => row.key), ...fields.flatMap((row) => row.currency_key ?? [])])];
  // One row past the cap tells a full result from a cut one without counting.
  return capRows(await queries.rows({ view, columns, limit: ROW_CAP + 1 }));
}

/** Active items of a lookup table that some report field names, or undefined for any other table. */
export async function getLookup(table: string, queries: Queries | null): Promise<LookupItem[] | undefined> {
  if (!queries) return generatorLookup(table);
  const named = (await queries.catalogue()).find((row) => row.lookup_table === table);
  if (!named) return undefined;
  const rows = await queries.lookup(`${named.lookup_schema}.${named.lookup_table}`);
  return rows.map((row) => ({
    code: row.code,
    label: { en: row.label_en, he: row.label_he },
    tone: row.tone,
    sortOrder: row.sort_order,
  }));
}
