import { describe, expect, it, vi } from "vitest";
import { REPORTS } from "@/data/reports";
import type { Row } from "@/data/types";
import { ROW_CAP, getCatalogue, getLookup, getReportRows, type CatalogueRow, type Queries } from "./source";

const field = (overrides: Partial<CatalogueRow>): CatalogueRow => ({
  id: "orders",
  icon: "orders",
  tags: ["sales"],
  title_en: "Orders",
  title_he: "הזמנות",
  desc_en: "Every order.",
  desc_he: "כל הזמנה.",
  key: "orderId",
  type: "string",
  label_en: "Order",
  label_he: "הזמנה",
  currency_key: null,
  lookup_schema: null,
  lookup_table: null,
  ...overrides,
});

const CATALOGUE: CatalogueRow[] = [
  field({}),
  field({ key: "status", type: "status", label_en: "Status", label_he: "סטטוס", lookup_schema: "public", lookup_table: "order_statuses" }),
  field({ key: "amount", type: "currency", label_en: "Amount", label_he: "סכום", currency_key: "currency" }),
  // In the metadata but not in the app's view allow-list: must never be queried.
  field({ id: "secrets", key: "token" }),
];

function fakeQueries(rows: Row[] = []): Queries {
  return {
    catalogue: vi.fn(async () => CATALOGUE),
    rows: vi.fn(async () => rows),
    lookup: vi.fn(async () => [{ code: "late", label_en: "Late", label_he: "באיחור", tone: "warning", sort_order: 4 }]),
  };
}

const HOSTILE_IDS = ["nope", "orders;drop", "reports.orders", "constructor", "__proto__", "secrets", ""];
const HOSTILE_TABLES = ["users", "pg_authid", "public.order_statuses", "order_statuses; drop table x", "constructor", ""];

describe("getReportRows", () => {
  it.each(HOSTILE_IDS)("rejects the unknown id %j on both paths without querying", async (id) => {
    const queries = fakeQueries();
    expect(await getReportRows(id, queries)).toBeUndefined();
    expect(queries.rows).not.toHaveBeenCalled();
    expect(await getReportRows(id, null)).toBeUndefined();
  });

  it("reads the allow-listed view with the report's field and currency columns", async () => {
    const queries = fakeQueries([{ orderId: "A-1" }]);
    expect(await getReportRows("orders", queries)).toEqual({ rows: [{ orderId: "A-1" }] });
    expect(queries.rows).toHaveBeenCalledWith({
      view: "reports.orders",
      columns: ["orderId", "status", "amount", "currency"],
      limit: ROW_CAP + 1,
    });
  });

  it("caps the rows and flags the cut", async () => {
    const over = Array.from({ length: ROW_CAP + 1 }, (_, index) => ({ orderId: `A-${index}` }));
    const body = await getReportRows("orders", fakeQueries(over));
    expect(body?.rows).toHaveLength(ROW_CAP);
    expect(body?.truncated).toBe(true);
  });

  it("falls back to generated rows that carry every field key", async () => {
    const body = await getReportRows("orders", null);
    expect(body?.truncated).toBeUndefined();
    expect(body?.rows.length).toBeGreaterThan(0);
    const keys = REPORTS[0].fields.map((item) => item.key);
    expect(Object.keys(body?.rows[0] ?? {})).toEqual(expect.arrayContaining(keys));
  });
});

describe("getLookup", () => {
  it.each(HOSTILE_TABLES)("rejects the table %j on both paths without querying", async (table) => {
    const queries = fakeQueries();
    expect(await getLookup(table, queries)).toBeUndefined();
    expect(queries.lookup).not.toHaveBeenCalled();
    expect(await getLookup(table, null)).toBeUndefined();
  });

  it("reads a table named by the report metadata and shapes its rows", async () => {
    const queries = fakeQueries();
    expect(await getLookup("order_statuses", queries)).toEqual([
      { code: "late", label: { en: "Late", he: "באיחור" }, tone: "warning", sortOrder: 4 },
    ]);
    expect(queries.lookup).toHaveBeenCalledWith("public.order_statuses");
  });

  it("builds the same shape from the generator's options, tones and messages", async () => {
    const statuses = await getLookup("order_statuses", null);
    expect(statuses?.map((item) => item.code)).toEqual(["delivered", "shipped", "processing", "late", "cancelled", "returned"]);
    expect(statuses?.[0]).toEqual({ code: "delivered", label: { en: "Delivered", he: "נמסר" }, tone: "success", sortOrder: 1 });
    expect((await getLookup("sales_channels", null))?.[1]).toEqual({
      code: "mobile",
      label: { en: "Mobile app", he: "אפליקציה" },
      tone: "neutral",
      sortOrder: 2,
    });
    expect((await getLookup("countries", null))?.[0]).toMatchObject({ code: "IL", label: { en: "Israel", he: "ישראל" } });
    expect((await getLookup("currencies", null))?.[0]).toMatchObject({ code: "USD", label: { en: "USD", he: "USD" } });
  });
});

describe("getCatalogue", () => {
  it("groups metadata rows into reports with ordered fields", async () => {
    const [orders, secrets] = await getCatalogue(fakeQueries());
    expect(orders).toMatchObject({ id: "orders", title: { en: "Orders", he: "הזמנות" }, description: { en: "Every order." } });
    expect(orders.fields).toEqual([
      { key: "orderId", type: "string", label: { en: "Order", he: "הזמנה" }, lookup: null, currencyKey: null },
      { key: "status", type: "status", label: { en: "Status", he: "סטטוס" }, lookup: "order_statuses", currencyKey: null },
      { key: "amount", type: "currency", label: { en: "Amount", he: "סכום" }, lookup: null, currencyKey: "currency" },
    ]);
    expect(secrets.fields).toHaveLength(1);
  });

  it("falls back to the app's reports, with labels and lookups and no row count", async () => {
    const reports = await getCatalogue(null);
    expect(reports.map((report) => report.id)).toEqual(REPORTS.map((report) => report.id));
    expect(reports[0].title).toEqual({ en: "Orders", he: "הזמנות" });
    expect(reports[0].fields.find((item) => item.key === "status")).toEqual({
      key: "status",
      type: "status",
      label: { en: "Status", he: "סטטוס" },
      lookup: "order_statuses",
      currencyKey: null,
    });
    expect(reports[1].fields.find((item) => item.key === "country")?.lookup).toBe("countries");
    expect(JSON.stringify(reports)).not.toMatch(/rowCount|row_count|"count"/);
  });
});
