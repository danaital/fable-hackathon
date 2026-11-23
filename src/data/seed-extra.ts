import { AGENTS, COUNTRIES, CURRENCIES, DAY_MS, HISTORY_DAYS, isoDate, isoDateTime, round2, type Customer, type Rng } from "./seed";
import type { Row } from "./types";

export const INVOICE_STATUSES = ["paid", "open", "overdue", "void"] as const;
export const PAYMENT_METHODS = ["card", "transfer", "paypal", "cash"] as const;
export const CARRIERS = ["dhl", "ups", "fedex", "local"] as const;
export const SHIPMENT_STATUSES = ["in_transit", "delivered", "delayed", "lost", "returned"] as const;
export const TICKET_STATUSES = ["new", "open", "pending", "resolved", "closed"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const TICKET_CHANNELS = ["email", "chat", "phone", "web"] as const;
export const CATEGORIES = ["hardware", "software", "accessories", "services", "furniture"] as const;
export const STOCK_STATUSES = ["in_stock", "low_stock", "out_of_stock", "discontinued"] as const;

const PRODUCT_WORDS = ["Desk", "Lamp", "Monitor", "Keyboard", "Router", "License", "Chair", "Cable", "Dock", "Headset"];
const PRODUCT_TIERS = ["Basic", "Pro", "Max", "Mini", "Plus"];
const TICKET_TOPICS = ["Billing question", "Login problem", "Late delivery", "Refund request", "Damaged item", "Feature request"];
const SLA_HOURS = { low: 72, normal: 48, high: 24, urgent: 4 } as const;
const LOW_STOCK_LIMIT = 10;
const HOURS_MS = 3_600_000;

export function buildInvoices(rng: Rng, orders: readonly Row[]): Row[] {
  return orders
    .filter((order) => order.status !== "cancelled")
    .map((order, i) => {
      const issued = Date.parse(String(order.orderDate));
      const due = issued + rng.pick([14, 30, 45]) * DAY_MS;
      const status = rng.weighted(INVOICE_STATUSES, [70, 15, 12, 3]);
      const net = Number(order.amount);
      const taxPct = rng.pick([0, 17, 18, 20]);
      return {
        invoiceId: `INV-${50000 + i}`,
        orderId: order.orderId,
        customer: order.customer,
        country: order.country,
        status,
        issuedOn: isoDate(issued),
        dueOn: isoDate(due),
        paidOn: status === "paid" ? isoDate(issued + rng.int(0, 40) * DAY_MS) : null,
        net,
        taxPct,
        total: round2(net * (1 + taxPct / 100)),
        currency: order.currency,
        method: status === "paid" ? rng.weighted(PAYMENT_METHODS, [55, 30, 12, 3]) : null,
        reminded: status === "overdue" || (status === "open" && rng.next() > 0.6),
      };
    });
}

export function buildShipments(rng: Rng, orders: readonly Row[]): Row[] {
  return orders
    .filter((order) => order.status !== "cancelled" && order.status !== "processing")
    .map((order, i) => {
      const shipped = Date.parse(String(order.orderDate)) + rng.int(0, 3) * DAY_MS;
      const promisedDays = order.express ? rng.int(1, 3) : rng.int(3, 10);
      const status = rng.weighted(SHIPMENT_STATUSES, [20, 60, 14, 2, 4]);
      const arrived = status === "delivered" || status === "returned";
      const delayDays = status === "delayed" ? rng.int(1, 9) : arrived && rng.next() > 0.8 ? rng.int(1, 4) : 0;
      return {
        shipmentId: `SH-${70000 + i}`,
        orderId: order.orderId,
        carrier: rng.weighted(CARRIERS, [30, 30, 25, 15]),
        destination: order.country,
        status,
        shippedAt: isoDateTime(shipped),
        promisedOn: isoDate(shipped + promisedDays * DAY_MS),
        deliveredOn: arrived ? isoDate(shipped + (promisedDays + delayDays) * DAY_MS) : null,
        delayDays,
        weightKg: round2(0.2 + rng.next() ** 2 * 40),
        cost: round2(5 + rng.next() * 120),
        currency: rng.pick(CURRENCIES),
        express: order.express,
      };
    });
}

export function buildTickets(rng: Rng, customers: readonly Customer[], count: number, now: number): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const customer = rng.pick(customers);
    const priority = rng.weighted(PRIORITIES, [30, 45, 18, 7]);
    const status = rng.weighted(TICKET_STATUSES, [10, 20, 12, 33, 25]);
    const opened = now - rng.int(0, HISTORY_DAYS / 2) * DAY_MS - rng.int(0, DAY_MS);
    const firstResponseH = round2(0.1 + rng.next() ** 2 * SLA_HOURS[priority] * 1.6);
    const solved = status === "resolved" || status === "closed";
    return {
      ticketId: `T-${30000 + i}`,
      subject: rng.pick(TICKET_TOPICS),
      customer: customer.name,
      country: customer.country,
      channel: rng.weighted(TICKET_CHANNELS, [40, 30, 15, 15]),
      priority,
      status,
      openedAt: isoDateTime(opened),
      resolvedAt: solved ? isoDateTime(opened + rng.int(1, 240) * HOURS_MS) : null,
      firstResponseH,
      slaMet: firstResponseH <= SLA_HOURS[priority],
      satisfaction: solved && rng.next() > 0.35 ? rng.int(1, 5) : null,
      agent: rng.pick(AGENTS),
      email: customer.email,
    };
  });
}

export function buildProducts(rng: Rng, count: number, now: number): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const stock = rng.next() > 0.12 ? rng.int(0, 400) : 0;
    const discontinued = rng.next() > 0.94;
    const cost = round2(4 + rng.next() ** 2 * 900);
    return {
      sku: `SKU-${1000 + i}`,
      name: `${rng.pick(PRODUCT_WORDS)} ${rng.pick(PRODUCT_TIERS)} ${i % 7 === 0 ? "II" : ""}`.trim(),
      category: rng.pick(CATEGORIES),
      origin: rng.pick(COUNTRIES),
      stockStatus: discontinued ? "discontinued" : stock === 0 ? "out_of_stock" : stock < LOW_STOCK_LIMIT ? "low_stock" : "in_stock",
      stock,
      cost,
      price: round2(cost * (1.15 + rng.next() * 1.2)),
      currency: "USD",
      marginPct: 0,
      unitsSold: rng.int(0, 1500),
      launchedOn: isoDate(now - rng.int(30, HISTORY_DAYS * 5) * DAY_MS),
      active: !discontinued,
    };
  }).map((row) => ({ ...row, marginPct: round2(((Number(row.price) - Number(row.cost)) / Number(row.price)) * 100) }));
}
