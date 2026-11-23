import { SEED, buildCustomerRows, buildCustomers, buildOrders, createRng } from "./seed";
import { buildInvoices, buildProducts, buildShipments, buildTickets } from "./seed-extra";
import type { Row } from "./types";

// shortcut: rows are generated in memory from a fixed seed, so every restart gives the same data.
// Replaced by the primary database (Supabase) once it is connected; this generator then becomes the seed script.
const ORDER_COUNT = 2000;
const CUSTOMER_COUNT = 240;
const TICKET_COUNT = 900;
const PRODUCT_COUNT = 160;

let cache: Record<string, Row[]> | null = null;

export function getSeededRows(): Record<string, Row[]> {
  if (cache) return cache;
  const rng = createRng(SEED);
  const now = Date.now();
  const customers = buildCustomers(rng, CUSTOMER_COUNT, now);
  const orders = buildOrders(rng, customers, ORDER_COUNT, now);
  cache = {
    orders,
    customers: buildCustomerRows(customers, orders),
    invoices: buildInvoices(rng, orders),
    shipments: buildShipments(rng, orders),
    tickets: buildTickets(rng, customers, TICKET_COUNT, now),
    products: buildProducts(rng, PRODUCT_COUNT, now),
  };
  return cache;
}
