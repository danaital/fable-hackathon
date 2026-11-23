import { NextResponse } from "next/server";
import { z } from "zod";
import { LATEST, MAX_DATES_PER_REQUEST, MIN_RATE_DATE, RATE_CURRENCIES, isValidIsoDay, isoDay } from "@/features/currency/codes";
import { fetchRates, isImmutable } from "@/features/currency/upstream";
import { logger } from "@/lib/logger";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const SHORT_CACHE = "public, max-age=300";

const code = z.enum(RATE_CURRENCIES);
const day = z
  .string()
  .refine((value) => value === LATEST || (isValidIsoDay(value) && value >= MIN_RATE_DATE && value <= isoDay(new Date())));
// Comma-separated list; the cap applies before duplicates are dropped so the raw query stays bounded.
const list = (max: number) =>
  z
    .string()
    .transform((value) => value.split(","))
    .pipe(z.array(z.string()).min(1).max(max))
    .transform((items) => [...new Set(items)]);

const querySchema = z
  .object({
    base: code,
    symbols: list(RATE_CURRENCIES.length).pipe(z.array(code)),
    date: list(MAX_DATES_PER_REQUEST).pipe(z.array(day)).default([LATEST]),
  })
  .refine((query) => !query.symbols.includes(query.base));

// shortcut: no auth check yet because login is not built; rates are public data. Add the session check when auth lands.
export async function GET(request: Request) {
  const baseUrl = process.env.FRANKFURTER_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    logger.error("rates: FRANKFURTER_URL is not set");
    return NextResponse.json({ error: "rates_not_configured" }, { status: 503 });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const { base, symbols, date: dates } = parsed.data;

  try {
    const rates = await fetchRates({ baseUrl, base, symbols, dates });
    const cacheControl = dates.every(isImmutable) ? IMMUTABLE_CACHE : SHORT_CACHE;
    return NextResponse.json({ base, rates }, { headers: { "Cache-Control": cacheControl } });
  } catch (error) {
    // Upstream bodies are never forwarded or logged; the error name and message are ours or the runtime's.
    logger.warn("rates: upstream failed", { base, reason: error instanceof Error ? `${error.name}: ${error.message}` : "unknown" });
    return NextResponse.json({ error: "rates_upstream_failed" }, { status: 502 });
  }
}
