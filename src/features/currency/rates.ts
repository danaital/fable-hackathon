"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { DISPLAY_CURRENCIES } from "@/features/settings/schema";
import { MAX_DATES_PER_REQUEST, isRateCurrency } from "./codes";
import { rateKey, type RateEntry, type RateRequest, type RateTable } from "./convert";

const RATES_URL = "/api/rates";
const KEY_SEPARATOR = "|";
const LIST_SEPARATOR = ",";

const responseSchema = z.object({
  rates: z.record(z.string(), z.object({ date: z.string(), rates: z.record(z.string(), z.number().positive()) })),
});

// Session cache shared by every hook: one fetch per (base, date), answers kept until reload.
// shortcut: "latest" is also kept for the session; add an expiry if sessions get long.
const settled = new Map<string, RateEntry | null>();
const inflight = new Set<string>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
const tables = new Map<string, RateTable>();
const EMPTY: RateTable = new Map();

function notify(): void {
  tables.clear();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const keysOf = (signature: string) => (signature ? signature.split(LIST_SEPARATOR) : []);

function tableFor(signature: string): RateTable {
  const cached = tables.get(signature);
  if (cached) return cached;
  const table = new Map<string, RateEntry>();
  for (const key of keysOf(signature)) {
    const entry = settled.get(key);
    if (entry) table.set(key, entry);
  }
  tables.set(signature, table);
  return table;
}

async function loadChunk(base: string, dates: string[]): Promise<void> {
  const keys = dates.map((date) => rateKey(base, date));
  keys.forEach((key) => inflight.add(key));
  try {
    // All display currencies at once, so switching the target needs no new request.
    const symbols = DISPLAY_CURRENCIES.filter((code) => code !== base).join(LIST_SEPARATOR);
    const query = new URLSearchParams({ base, symbols, date: dates.join(LIST_SEPARATOR) });
    const response = await fetch(`${RATES_URL}?${query.toString()}`);
    if (!response.ok) throw new Error(`rates request failed: ${response.status}`);
    const body = responseSchema.parse(await response.json());
    dates.forEach((date) => settled.set(rateKey(base, date), body.rates[date] ?? null));
  } catch {
    keys.forEach((key) => failed.add(key));
  } finally {
    keys.forEach((key) => inflight.delete(key));
    notify();
  }
}

function load(signature: string): void {
  const datesByBase = new Map<string, string[]>();
  for (const key of keysOf(signature)) {
    if (settled.has(key) || inflight.has(key) || failed.has(key)) continue;
    const [base, date] = key.split(KEY_SEPARATOR);
    if (!isRateCurrency(base)) continue;
    datesByBase.set(base, [...(datesByBase.get(base) ?? []), date]);
  }
  for (const [base, dates] of datesByBase) {
    // Sorted chunks keep each server-side time series short.
    const sorted = dates.sort();
    for (let start = 0; start < sorted.length; start += MAX_DATES_PER_REQUEST) {
      void loadChunk(base, sorted.slice(start, start + MAX_DATES_PER_REQUEST));
    }
  }
}

export type RatesStatus = "loading" | "ready" | "error";

export interface RatesState {
  rates: RateTable;
  status: RatesStatus;
  /** Ask again for rates whose last request failed. */
  retry: () => void;
}

/**
 * Fetches (once per session) and returns the rates for these requests.
 * Pass the same requests every render or a new array with the same content: only the content matters.
 */
export function useRates(requests: readonly RateRequest[]): RatesState {
  const signature = useMemo(() => [...new Set(requests.map((r) => rateKey(r.base, r.date)))].sort().join(LIST_SEPARATOR), [requests]);
  const [attempt, setAttempt] = useState(0);
  const rates = useSyncExternalStore(subscribe, () => tableFor(signature), () => EMPTY);

  useEffect(() => load(signature), [signature, attempt]);

  const retry = useCallback(() => {
    keysOf(signature).forEach((key) => failed.delete(key));
    setAttempt((n) => n + 1);
  }, [signature]);

  return { rates, status: statusOf(keysOf(signature)), retry };
}

function statusOf(keys: readonly string[]): RatesStatus {
  if (keys.every((key) => settled.has(key))) return "ready";
  return keys.some((key) => failed.has(key)) ? "error" : "loading";
}
