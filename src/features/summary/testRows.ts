import type { FieldDef, Row } from "@/data/types";

// Shared fixtures for the summary unit tests.
export const FIELDS: FieldDef[] = [
  { key: "status", type: "status", labelKey: "field.status" },
  { key: "agent", type: "string", labelKey: "field.agent" },
  { key: "items", type: "number", labelKey: "field.items" },
  { key: "amount", type: "currency", labelKey: "field.amount", currencyKey: "currency" },
  { key: "currency", type: "enum", labelKey: "field.currency" },
  { key: "discountPct", type: "percent", labelKey: "field.discountPct" },
  { key: "orderDate", type: "date", labelKey: "field.orderDate" },
  { key: "express", type: "boolean", labelKey: "field.express" },
];

export const ROWS: Row[] = [
  { status: "delivered", agent: "Noa", items: 2, amount: 100, currency: "USD", discountPct: 10, orderDate: "2026-11-20", express: true },
  { status: "delivered", agent: "Noa", items: 4, amount: 300, currency: "USD", discountPct: 0, orderDate: "2026-11-02", express: false },
  { status: "late", agent: "Amir", items: null, amount: 50, currency: "USD", discountPct: 20, orderDate: "2026-10-15", express: false },
  { status: "late", agent: "Amir", items: 9, amount: null, currency: "USD", discountPct: null, orderDate: "2026-10-01", express: true },
  { status: null, agent: null, items: 5, amount: 50, currency: "USD", discountPct: 0, orderDate: null, express: false },
];

/** The same rows with one amount in another currency. */
export const MIXED_ROWS: Row[] = ROWS.map((row, index) => (index === 0 ? { ...row, currency: "EUR" } : row));

export const NOW = new Date(2026, 10, 23, 12);
