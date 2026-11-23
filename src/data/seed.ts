import type { Row } from "./types";

// shortcut: rows are generated in memory from a fixed seed, so every restart gives the same data.
// Upgrade to Supabase tables (same generator as the seed script) when auth and saved views land.

export const SEED = 20261123;
export const DAY_MS = 86_400_000;
export const HISTORY_DAYS = 365;

export const STATUSES = ["delivered", "shipped", "processing", "late", "cancelled", "returned"] as const;
export const CHANNELS = ["web", "mobile", "phone", "partner"] as const;
export const CURRENCIES = ["USD", "EUR", "ILS", "GBP"] as const;
export const COUNTRIES = ["IL", "US", "DE", "FR", "GB", "ES", "IT", "NL", "JP", "BR"] as const;
export const SEGMENTS = ["enterprise", "business", "starter"] as const;

const NAME_A = ["Cedar", "Harbor", "Northwind", "Juniper", "Atlas", "Lumen", "Granite", "Willow", "Copper", "Meridian", "Saffron", "Tidal"];
const NAME_B = ["Studio", "Books", "Cafe", "Labs", "Supply", "Travel", "Foods", "Design", "Motors", "Health", "Market", "Systems"];
export const AGENTS = ["Noa", "Amir", "Lena", "Omar", "Maya", "Jonas", "Tamar", "Felix"];
const STATUS_WEIGHTS = [52, 14, 12, 9, 8, 5];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  weighted: <T>(items: readonly T[], weights: readonly number[]) => T;
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)];
  const weighted = <T>(items: readonly T[], weights: readonly number[]): T => {
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = next() * total;
    for (let i = 0; i < items.length; i += 1) {
      roll -= weights[i];
      if (roll < 0) return items[i];
    }
    return items[items.length - 1];
  };
  return { next, int, pick, weighted };
}

export const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const isoDateTime = (ms: number) => new Date(ms).toISOString();
export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface Customer {
  customerId: string;
  name: string;
  country: string;
  segment: string;
  email: string;
  since: string;
  active: boolean;
}

export function buildCustomers(rng: Rng, count: number, now: number): Customer[] {
  return Array.from({ length: count }, (_, i) => {
    const name = `${rng.pick(NAME_A)} ${rng.pick(NAME_B)}`;
    return {
      customerId: `C-${1000 + i}`,
      name,
      country: rng.pick(COUNTRIES),
      segment: rng.weighted(SEGMENTS, [15, 45, 40]),
      // example.com is reserved for documentation, so no address here can be real.
      email: `${name.toLowerCase().replace(/\s+/g, ".")}.${i}@example.com`,
      since: isoDate(now - rng.int(30, HISTORY_DAYS * 4) * DAY_MS),
      active: rng.next() > 0.12,
    };
  });
}

export function buildOrders(rng: Rng, customers: Customer[], count: number, now: number): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const customer = rng.pick(customers);
    const status = rng.weighted(STATUSES, STATUS_WEIGHTS);
    const ordered = now - rng.int(0, HISTORY_DAYS) * DAY_MS - rng.int(0, DAY_MS);
    const delivered = status === "delivered" || status === "returned";
    const paid = status !== "cancelled" && rng.next() > 0.08;
    return {
      orderId: `A-${10000 + i}`,
      customer: customer.name,
      country: customer.country,
      channel: rng.weighted(CHANNELS, [50, 28, 12, 10]),
      status,
      orderDate: isoDate(ordered),
      deliveryDate: delivered ? isoDate(ordered + rng.int(1, 14) * DAY_MS) : null,
      paidAt: paid ? isoDateTime(ordered + rng.int(0, 5 * DAY_MS)) : null,
      amount: round2(20 + rng.next() ** 2 * 4980),
      currency: rng.weighted(CURRENCIES, [40, 25, 25, 10]),
      items: rng.int(1, 12),
      discountPct: rng.next() > 0.6 ? rng.int(1, 6) * 5 : 0,
      express: rng.next() > 0.75,
      agent: rng.pick(AGENTS),
      email: customer.email,
    };
  });
}

export function buildCustomerRows(customers: Customer[], orders: Row[]): Row[] {
  const totals = new Map<string, { orders: number; value: number }>();
  for (const order of orders) {
    const key = String(order.customer);
    const entry = totals.get(key) ?? { orders: 0, value: 0 };
    entry.orders += 1;
    entry.value += Number(order.amount);
    totals.set(key, entry);
  }
  return customers.map((c) => ({
    customerId: c.customerId,
    name: c.name,
    country: c.country,
    segment: c.segment,
    since: c.since,
    orders: totals.get(c.name)?.orders ?? 0,
    // shortcut: sums mixed currencies as if they were one; replace when currency conversion lands.
    lifetimeValue: round2(totals.get(c.name)?.value ?? 0),
    currency: "USD",
    active: c.active,
    email: c.email,
  }));
}

