import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Queries } from "@/lib/db/source";

// The real client imports "server-only" and the driver; routes only need its switch.
const source = vi.hoisted(() => ({ queries: null as Queries | null }));
vi.mock("@/lib/db/client", () => ({ getQueries: () => source.queries }));

import { GET as getLookupRoute } from "@/app/api/lookups/[table]/route";
import { GET as getRowsRoute } from "@/app/api/reports/[id]/rows/route";
import { GET as getReportsRoute } from "@/app/api/reports/route";

const HEADER = "x-bahir-data-source";
const BASE = "http://localhost";
const rows = (id: string, query = "") =>
  getRowsRoute(new Request(`${BASE}/api/reports/${encodeURIComponent(id)}/rows${query}`), { params: Promise.resolve({ id }) });
const lookup = (table: string) =>
  getLookupRoute(new Request(`${BASE}/api/lookups/${encodeURIComponent(table)}`), { params: Promise.resolve({ table }) });

beforeEach(() => {
  source.queries = null;
});

describe("data routes on the generator path", () => {
  it("serves report rows with the data-source header", async () => {
    const response = await rows("orders");
    expect(response.status).toBe(200);
    expect(response.headers.get(HEADER)).toBe("generator");
    const body = await response.json();
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.rows[0]).toHaveProperty("orderId");
  });

  it.each(["orders;drop", "Orders", "../etc", "a".repeat(60)])("answers 400 to the malformed report id %j", async (id) => {
    const response = await rows(id);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_report_id" });
    expect(response.headers.get(HEADER)).toBe("generator");
  });

  it("answers 404 to a well-formed unknown report and 400 to query parameters", async () => {
    expect((await rows("constructor")).status).toBe(404);
    expect((await rows("orders", "?limit=5")).status).toBe(400);
  });

  it("serves lookups and rejects hostile table names", async () => {
    const response = await lookup("order_statuses");
    expect(response.status).toBe(200);
    expect((await response.json()).items[0]).toEqual({ code: "delivered", label: { en: "Delivered", he: "נמסר" }, tone: "success", sortOrder: 1 });
    expect((await lookup("order_statuses;drop")).status).toBe(400);
    expect((await lookup("public.users")).status).toBe(400);
    expect((await lookup("pg_authid")).status).toBe(404);
  });

  it("serves the catalogue without row counts", async () => {
    const response = await getReportsRoute(new Request(`${BASE}/api/reports`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reports).toHaveLength(6);
    expect(body.reports[0]).not.toHaveProperty("rowCount");
  });
});

describe("data routes on the Postgres path", () => {
  it("answers 503 when the database read fails, without falling back", async () => {
    const failing = async () => {
      throw Object.assign(new Error("connect failed for postgres://user:secret@host"), { code: "ECONNREFUSED" });
    };
    source.queries = { catalogue: failing, rows: failing, lookup: failing };
    const response = await rows("orders");
    expect(response.status).toBe(503);
    expect(response.headers.get(HEADER)).toBe("postgres");
    expect(await response.json()).toEqual({ error: "data_source_unavailable" });
  });
});
