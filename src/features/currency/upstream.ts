import { z } from "zod";
import { ISO_DATE_PATTERN, LATEST, isoDay } from "./codes";
import type { RateEntry } from "./convert";

// Server only: talks to the rate provider (Frankfurter v1) and caches its answers in this process.

const TIMEOUT_MS = 8_000;
const LATEST_TTL_MS = 5 * 60_000;
// shortcut: per-process memory cache with a crude size cap; move to a shared store (KV) if instances multiply.
const MAX_CACHE_ENTRIES = 5_000;

const ratesSchema = z.record(z.string().regex(/^[A-Z]{3}$/), z.number().positive());
const singleSchema = z.object({ base: z.string(), date: z.string().regex(ISO_DATE_PATTERN), rates: ratesSchema });
const seriesSchema = z.object({ base: z.string(), rates: z.record(z.string().regex(ISO_DATE_PATTERN), ratesSchema) });

export class UpstreamError extends Error {}

const cache = new Map<string, { entry: RateEntry; expires: number }>();

export function clearRateCache(): void {
  cache.clear();
}

interface RatesQuery {
  baseUrl: string;
  base: string;
  symbols: readonly string[];
  /** Requested days ("YYYY-MM-DD" or "latest"), already validated. */
  dates: readonly string[];
}

/** Past days never change; today and "latest" can still be republished. */
export const isImmutable = (date: string) => date !== LATEST && date < isoDay(new Date());

async function getJson<T>(url: string, schema: z.ZodType<T>, base: string): Promise<T & { base: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new UpstreamError(`status ${response.status}`);
  const parsed = z.intersection(schema, z.object({ base: z.literal(base) })).safeParse(await response.json());
  if (!parsed.success) throw new UpstreamError("unexpected response shape");
  return parsed.data;
}

/** Rates per requested day. Several days cost one time-series call; the provider's own day is kept in `date`. */
export async function fetchRates({ baseUrl, base, symbols, dates }: RatesQuery): Promise<Record<string, RateEntry>> {
  const query = new URLSearchParams({ base, symbols: symbols.join(",") }).toString();
  const key = (date: string) => `${base}|${query}|${date}`;
  const result: Record<string, RateEntry> = {};
  const store = (requested: string, entry: RateEntry) => {
    result[requested] = entry;
    if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
    cache.set(key(requested), { entry, expires: isImmutable(requested) ? Infinity : Date.now() + LATEST_TTL_MS });
  };

  const missing: string[] = [];
  for (const date of dates) {
    const hit = cache.get(key(date));
    if (hit && hit.expires > Date.now()) result[date] = hit.entry;
    else missing.push(date);
  }

  const days = missing.filter((date) => date !== LATEST).sort();
  const singles = missing.includes(LATEST) ? [LATEST] : [];
  if (days.length > 0) {
    const series = await getJson(`${baseUrl}/${days[0]}..${days[days.length - 1]}?${query}`, seriesSchema, base);
    const published = Object.keys(series.rates).sort();
    for (const day of days) {
      // The series lists every business day in range, so the last one on or before `day` is the provider's answer for it.
      const used = published.filter((candidate) => candidate <= day).pop();
      if (used) store(day, { date: used, rates: series.rates[used] });
      else singles.push(day);
    }
  }
  await Promise.all(
    singles.map(async (date) => {
      const single = await getJson(`${baseUrl}/${date}?${query}`, singleSchema, base);
      store(date, { date: single.date, rates: single.rates });
    }),
  );
  return result;
}
