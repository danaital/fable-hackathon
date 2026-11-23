import "server-only";
import postgres from "postgres";
import type { Row } from "@/data/types";
import { logger } from "@/lib/logger";
import type { CatalogueRow, LookupRow, Queries } from "./source";

// POSTGRES_URL is Supabase's transaction pooler. Options follow Supabase "Connect to your database"
// (Configure your client, Transaction mode limitations) and the postgres.js README (Connection poolers).
// The pooler allows no pipelining, so a connection carries one query; a report page asks for rows and
// several lookups at once, hence more than the single connection Supabase suggests per instance.
const POOL_SIZE = 3;
const MAX_PIPELINE = 1;
const CONNECT_TIMEOUT_S = 10;
const IDLE_TIMEOUT_S = 20;
const QUERY_TIMEOUT_S = 30;
// A local demo database has no TLS; every other host must use it.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const CATALOGUE_TTL_MS = 5 * 60_000;

// Kept on globalThis so dev hot reloads reuse one pool instead of leaking a new one per reload.
const globalForDb = globalThis as typeof globalThis & { bahirSql?: postgres.Sql };

function getSql(): postgres.Sql {
  const url = process.env.POSTGRES_URL?.trim();
  if (!url) throw new Error("POSTGRES_URL is not set");
  globalForDb.bahirSql ??= postgres(url, {
    max: POOL_SIZE,
    max_pipeline: MAX_PIPELINE,
    prepare: false,
    ssl: LOCAL_HOSTS.has(new URL(url).hostname) ? false : "require",
    connect_timeout: CONNECT_TIMEOUT_S,
    idle_timeout: IDLE_TIMEOUT_S,
    query_timeout: QUERY_TIMEOUT_S,
  });
  return globalForDb.bahirSql;
}

let catalogue: { expires: number; rows: CatalogueRow[] } | undefined;

const postgresQueries: Queries = {
  // Report metadata changes rarely, and it is the allow-list for report ids and lookup tables on every request.
  async catalogue() {
    if (catalogue && catalogue.expires > Date.now()) return catalogue.rows;
    const rows = await getSql()<CatalogueRow[]>`
      select r.id, r.icon, r.tags, r.title_en, r.title_he, r.desc_en, r.desc_he,
             f.key, f.type, f.label_en, f.label_he, f.currency_key,
             n.nspname as lookup_schema, c.relname as lookup_table
      from reports.reports r
      join reports.report_fields f on f.report_id = r.id
      left join pg_catalog.pg_class c on c.oid = f.lookup_table
      left join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where r.active
      order by r.sort_order, f.position
    `;
    catalogue = { expires: Date.now() + CATALOGUE_TTL_MS, rows };
    return rows;
  },
  rows({ view, columns, limit }) {
    const sql = getSql();
    return sql<Row[]>`select ${sql(columns)} from ${sql(view)} limit ${limit}`;
  },
  lookup(table) {
    const sql = getSql();
    return sql<LookupRow[]>`
      select code, label_en, label_he, tone, sort_order
      from ${sql(table)}
      where active
      order by sort_order, code
    `;
  },
};

let fallbackLogged = false;

const DATA_SOURCE_POSTGRES = "postgres";

/**
 * The Postgres reads only when BAHIR_DATA_SOURCE is "postgres" (explicit opt-in: POSTGRES_URL alone is not
 * enough, the SQL may not be applied there). A missing POSTGRES_URL then fails the read, which answers 503.
 * In every other case null: the caller serves generated data. Nothing connects until the first read.
 */
export function getQueries(): Queries | null {
  if (process.env.BAHIR_DATA_SOURCE?.trim() === DATA_SOURCE_POSTGRES) return postgresQueries;
  if (!fallbackLogged) {
    fallbackLogged = true;
    logger.warn("db: BAHIR_DATA_SOURCE is not \"postgres\", serving generated data instead of the primary database");
  }
  return null;
}
