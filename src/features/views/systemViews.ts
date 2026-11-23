import type { I18nKey } from "@/i18n";
import type { StoredState } from "./model";

/**
 * Built-in views, read-only for users (they can duplicate them). The first one listed for a report
 * is its baseline: it opens when the user has no default and no last-used view.
 * Operator and period names are the filters engine's stored values.
 */
const OPERATOR_EQUALS = "equals";
const OPERATOR_BETWEEN = "between";
const PERIOD_THIS_MONTH = "this_month";
export const SYSTEM_ID_PREFIX = "system:";
const SLOW_DELIVERY_DAYS = 7;
const HIGH_VALUE_AMOUNT = 500;

export interface SystemViewDef {
  id: string;
  reportId: string;
  nameKey: I18nKey;
  descKey: I18nKey;
  state: StoredState;
}

interface FilterInput {
  field: string;
  value?: string;
  period?: string;
}

const filter = ({ field, value, period }: FilterInput) => ({
  id: `${SYSTEM_ID_PREFIX}${field}`,
  field,
  operator: period ? OPERATOR_BETWEEN : OPERATOR_EQUALS,
  values: value === undefined ? [] : [value],
  period,
});

const descending = (key: string): StoredState => ({ sorts: [{ key, direction: "desc" }] });

export const SYSTEM_VIEWS: readonly SystemViewDef[] = [
  {
    id: "system:orders:recent",
    reportId: "orders",
    nameKey: "views.system.orders.recent.name",
    descKey: "views.system.orders.recent.desc",
    state: descending("orderDate"),
  },
  {
    id: "system:orders:late",
    reportId: "orders",
    nameKey: "views.system.orders.late.name",
    descKey: "views.system.orders.late.desc",
    state: { filters: [filter({ field: "status", value: "late" })], sorts: [{ key: "deliveryDate", direction: "asc" }] },
  },
  {
    id: "system:orders:thisMonth",
    reportId: "orders",
    nameKey: "views.system.orders.thisMonth.name",
    descKey: "views.system.orders.thisMonth.desc",
    state: { filters: [filter({ field: "orderDate", period: PERIOD_THIS_MONTH })], ...descending("orderDate") },
  },
  {
    // Field-to-field-to-value: (delivery date − order date) in days, compared with a value.
    id: "system:orders:slowDelivery",
    reportId: "orders",
    nameKey: "views.system.orders.slowDelivery.name",
    descKey: "views.system.orders.slowDelivery.desc",
    state: {
      filters: [
        {
          id: `${SYSTEM_ID_PREFIX}deliveryDate-orderDate`,
          field: "deliveryDate",
          compareField: "orderDate",
          fieldOperator: "fieldSubtract",
          operator: "greaterThan",
          values: [SLOW_DELIVERY_DAYS],
        },
      ],
      sorts: [{ key: "deliveryDate", direction: "desc" }],
    },
  },
  {
    // Amount filter typed in its own currency: each row is converted at its rate date before comparing.
    id: "system:orders:highValueEur",
    reportId: "orders",
    nameKey: "views.system.orders.highValueEur.name",
    descKey: "views.system.orders.highValueEur.desc",
    state: {
      filters: [
        {
          id: `${SYSTEM_ID_PREFIX}amount-eur`,
          field: "amount",
          operator: "greaterThan",
          values: [HIGH_VALUE_AMOUNT],
          currency: { targetCurrency: "EUR" },
        },
      ],
      sorts: [{ key: "amount", direction: "desc" }],
      totals: { orderId: "count", amount: "sum", items: "sum", discountPct: "avg" },
    },
  },
  {
    id: "system:customers:top",
    reportId: "customers",
    nameKey: "views.system.customers.top.name",
    descKey: "views.system.customers.top.desc",
    state: descending("lifetimeValue"),
  },
  {
    id: "system:customers:enterprise",
    reportId: "customers",
    nameKey: "views.system.customers.enterprise.name",
    descKey: "views.system.customers.enterprise.desc",
    state: { filters: [filter({ field: "segment", value: "enterprise" })], ...descending("lifetimeValue") },
  },
  {
    id: "system:invoices:recent",
    reportId: "invoices",
    nameKey: "views.system.invoices.recent.name",
    descKey: "views.system.invoices.recent.desc",
    state: descending("issuedOn"),
  },
  {
    id: "system:invoices:overdue",
    reportId: "invoices",
    nameKey: "views.system.invoices.overdue.name",
    descKey: "views.system.invoices.overdue.desc",
    state: { filters: [filter({ field: "status", value: "overdue" })], sorts: [{ key: "dueOn", direction: "asc" }] },
  },
  {
    id: "system:shipments:recent",
    reportId: "shipments",
    nameKey: "views.system.shipments.recent.name",
    descKey: "views.system.shipments.recent.desc",
    state: descending("shippedAt"),
  },
  {
    id: "system:shipments:delayed",
    reportId: "shipments",
    nameKey: "views.system.shipments.delayed.name",
    descKey: "views.system.shipments.delayed.desc",
    state: { filters: [filter({ field: "status", value: "delayed" })], ...descending("delayDays") },
  },
  {
    id: "system:tickets:newest",
    reportId: "tickets",
    nameKey: "views.system.tickets.newest.name",
    descKey: "views.system.tickets.newest.desc",
    state: descending("openedAt"),
  },
  {
    id: "system:tickets:urgent",
    reportId: "tickets",
    nameKey: "views.system.tickets.urgent.name",
    descKey: "views.system.tickets.urgent.desc",
    state: { filters: [filter({ field: "priority", value: "urgent" })], ...descending("openedAt") },
  },
  {
    id: "system:products:bestSellers",
    reportId: "products",
    nameKey: "views.system.products.bestSellers.name",
    descKey: "views.system.products.bestSellers.desc",
    state: descending("unitsSold"),
  },
  {
    id: "system:products:lowStock",
    reportId: "products",
    nameKey: "views.system.products.lowStock.name",
    descKey: "views.system.products.lowStock.desc",
    state: { filters: [filter({ field: "stockStatus", value: "low_stock" })], sorts: [{ key: "stock", direction: "asc" }] },
  },
];
