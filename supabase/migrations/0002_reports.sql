-- Reports schema: one view per report in reports.reports (0003), named after the report id.
-- Column names are the report's field keys exactly as in src/data/reports.ts, and column types are
-- JSON-ready (text ISO dates, int/float8 numbers, text codes that match the lookup tables), so rows
-- match the app's Row type with any client. Aggregates are materialized and refreshed nightly.
-- No grants to anon/authenticated: read reports from server code (Postgres URL / service role).
-- Plain views are security_invoker, so they still obey the primary tables' RLS if ever exposed.

create schema reports;
revoke all on schema reports from public;

create function reports.iso_date(ts timestamptz) returns text
language sql stable
as $$ select to_char(ts at time zone 'UTC', 'YYYY-MM-DD') $$;

create function reports.iso_datetime(ts timestamptz) returns text
language sql stable
as $$ select to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') $$;

-- The one definition of counted revenue: delivered, shipped or late orders, after discount, in USD cents.
create view reports.revenue_lines with (security_invoker = true) as
select
  o.id as order_id,
  o.customer_id,
  oi.product_id,
  oi.quantity,
  round(oi.quantity * oi.unit_price_cents * (100 - o.discount_pct) / 100.0 * er.usd_rate)::bigint as revenue_usd_cents
from public.orders o
join public.order_items oi on oi.order_id = o.id
join public.exchange_rates er on er.day = (o.created_at at time zone 'UTC')::date and er.currency = o.currency
where o.status in ('delivered', 'shipped', 'late');

create view reports.orders with (security_invoker = true) as
select
  'A-' || o.id as "orderId",
  c.name as customer,
  c.country,
  o.channel,
  o.status,
  reports.iso_date(o.created_at) as "orderDate",
  reports.iso_date(s.delivered_at) as "deliveryDate",
  reports.iso_datetime(pay.paid_at) as "paidAt",
  (o.total_cents / 100.0)::float8 as amount,
  o.currency,
  o.item_count as items,
  o.discount_pct::int as "discountPct",
  o.express,
  e.full_name as agent,
  c.email
from public.orders o
join public.customers c on c.id = o.customer_id
left join public.employees e on e.id = o.agent_id
left join public.shipments s on s.order_id = o.id
left join lateral (
  select min(p.created_at) as paid_at
  from public.payments p
  where p.order_id = o.id and p.status in ('captured', 'refunded')
) pay on true;

create view reports.invoices with (security_invoker = true) as
select
  'INV-' || i.id as "invoiceId",
  'A-' || i.order_id as "orderId",
  c.name as customer,
  c.country,
  i.status,
  to_char(i.issued_on, 'YYYY-MM-DD') as "issuedOn",
  to_char(i.due_on, 'YYYY-MM-DD') as "dueOn",
  to_char(i.paid_on, 'YYYY-MM-DD') as "paidOn",
  (i.net_cents / 100.0)::float8 as net,
  i.tax_pct::int as "taxPct",
  (i.total_cents / 100.0)::float8 as total,
  o.currency,
  i.method,
  i.reminded
from public.invoices i
join public.orders o on o.id = i.order_id
join public.customers c on c.id = o.customer_id;

create view reports.shipments with (security_invoker = true) as
select
  'SH-' || s.id as "shipmentId",
  'A-' || s.order_id as "orderId",
  s.carrier,
  c.country as destination,
  s.status,
  reports.iso_datetime(s.shipped_at) as "shippedAt",
  to_char(s.promised_on, 'YYYY-MM-DD') as "promisedOn",
  reports.iso_date(s.delivered_at) as "deliveredOn",
  -- days past the promised date: at delivery, or so far for a delayed shipment still on its way
  case
    when s.delivered_at is not null then greatest(0, (s.delivered_at at time zone 'UTC')::date - s.promised_on)
    when s.status = 'delayed' then greatest(0, (now() at time zone 'UTC')::date - s.promised_on)
    else 0
  end as "delayDays",
  round(s.weight_grams / 1000.0, 2)::float8 as "weightKg",
  (s.cost_cents / 100.0)::float8 as cost,
  o.currency,
  o.express
from public.shipments s
join public.orders o on o.id = s.order_id
join public.customers c on c.id = o.customer_id;

create view reports.tickets with (security_invoker = true) as
select
  'T-' || t.id as "ticketId",
  t.subject,
  c.name as customer,
  c.country,
  t.channel,
  t.priority,
  t.status,
  reports.iso_datetime(t.opened_at) as "openedAt",
  reports.iso_datetime(t.resolved_at) as "resolvedAt",
  round((extract(epoch from t.first_response_at - t.opened_at) / 3600)::numeric, 2)::float8 as "firstResponseH",
  t.first_response_at - t.opened_at <= make_interval(hours => p.sla_hours) as "slaMet",
  t.satisfaction::int as satisfaction,
  e.full_name as agent,
  c.email
from public.support_tickets t
join public.customers c on c.id = t.customer_id
join public.ticket_priorities p on p.code = t.priority
left join public.employees e on e.id = t.assignee_id;

-- Materialized (unique indexes allow refresh concurrently) ------------------------------------

create materialized view reports.customers as
select
  'C-' || c.id as "customerId",
  c.name,
  c.country,
  c.segment,
  reports.iso_date(c.created_at) as since,
  coalesce(o.orders, 0)::int as orders,
  coalesce(r.revenue, 0)::float8 as "lifetimeValue",
  'USD'::text as currency,
  c.active,
  c.email
from public.customers c
left join (select customer_id, count(*) as orders from public.orders group by customer_id) o
  on o.customer_id = c.id
left join (select customer_id, sum(revenue_usd_cents) / 100.0 as revenue from reports.revenue_lines group by customer_id) r
  on r.customer_id = c.id;
create unique index customers_key on reports.customers ("customerId");

create materialized view reports.products as
select
  p.sku,
  p.name,
  p.category,
  s.country as origin,
  -- under 10 units across all warehouses counts as low stock
  case
    when p.discontinued then 'discontinued'
    when coalesce(st.stock, 0) = 0 then 'out_of_stock'
    when st.stock < 10 then 'low_stock'
    else 'in_stock'
  end as "stockStatus",
  coalesce(st.stock, 0)::int as stock,
  (p.cost_usd_cents / 100.0)::float8 as cost,
  (p.price_usd_cents / 100.0)::float8 as price,
  'USD'::text as currency,
  round(100.0 * (p.price_usd_cents - p.cost_usd_cents) / p.price_usd_cents, 2)::float8 as "marginPct",
  coalesce(sold.units, 0)::int as "unitsSold",
  reports.iso_date(p.created_at) as "launchedOn",
  not p.discontinued as active
from public.products p
join public.suppliers s on s.id = p.supplier_id
left join (select product_id, sum(on_hand) as stock from public.inventory_levels group by product_id) st
  on st.product_id = p.id
left join (select product_id, sum(quantity) as units from reports.revenue_lines group by product_id) sold
  on sold.product_id = p.id;
create unique index products_key on reports.products (sku);
