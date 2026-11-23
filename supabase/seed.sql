-- Synthetic data for the primary schema, generated inside Postgres (no uploads, no dependency).
-- Lookup tables are filled by the migrations; this file fills everything else.
-- Run with psql after the migrations, in one transaction:
--   psql "$URL" -v ON_ERROR_STOP=1 --single-transaction [-v scale=0.0005] -f supabase/seed.sql
-- scale=1 (default) is ~4M orders, ~12M order lines, 10M web sessions (Supabase Pro);
-- scale=0.0005 is a ~2,000-order demo that fits any plan.
-- Distributions follow the app's in-memory generator (src/data/seed.ts, seed-extra.ts).
-- Emails use example.com (reserved, never real).

\if :{?scale}
\else
  \set scale 1
\endif

set statement_timeout = 0;
set work_mem = '128MB';

do $$
begin
  if exists (select 1 from public.warehouses) then
    raise exception 'seed.sql: data already present. To reseed run: truncate public.warehouses, public.suppliers, '
      'public.exchange_rates, public.marketing_campaigns, public.customers, public.employees restart identity cascade;';
  end if;
end;
$$;

create temp table seed_params as
select
  greatest(100, round(1000000 * :scale))::int as customers,
  greatest(100, round(50000 * :scale))::int as products, -- >= 5 and not a multiple of 7919 (see order_items)
  greatest(10, round(2000 * :scale))::int as suppliers,
  greatest(100, round(4000000 * :scale))::int as orders,
  greatest(100, round(10000000 * :scale))::int as sessions,
  greatest(100, round(1000000 * :scale))::int as reviews,
  greatest(100, round(600000 * :scale))::int as tickets,
  600 as employees, -- must stay a multiple of 10: team is picked by id % 10 below
  300 as campaigns,
  4 as warehouses_per_region,
  interval '2 years' as span;

select setseed(0.42);

-- Lookups are addressed by sort_order (1..n), so a random integer picks a code.
create temp table n_lookups as
select
  (select count(*) from public.regions)::int as regions,
  (select count(*) from public.countries)::int as countries,
  (select count(*) from public.product_categories)::int as categories;

-- Warehouse g serves the region with sort_order 1 + (g - 1) % regions,
-- so the region with sort_order k owns warehouses k, k + regions, k + 2 * regions, ...
insert into public.warehouses (code, region, city)
select 'WH-' || r.code || '-' || (1 + (g - 1) / n.regions), r.code, r.label_en || ' hub ' || (1 + (g - 1) / n.regions)
from seed_params p
cross join n_lookups n
cross join generate_series(1, n.regions * p.warehouses_per_region) g
join public.regions r on r.sort_order = 1 + (g - 1) % n.regions
order by g;

insert into public.suppliers (name, country)
select 'Supplier ' || d.g, c.code
from (
  select g, 1 + floor(random() * n.countries)::int as k
  from seed_params p, n_lookups n, generate_series(1, p.suppliers) g
  offset 0
) d
join public.countries c on c.sort_order = d.k
order by d.g;

insert into public.products (sku, name, category, supplier_id, price_usd_cents, cost_usd_cents, discontinued, created_at)
select 'SKU-' || lpad(d.g::text, 6, '0'), d.name, c.code, d.supplier_id, d.price, greatest(1, round(d.price * d.cost_share))::int, d.discontinued,
  now() - d.age_days * interval '1 day'
from (
  select
    g,
    (array['Desk', 'Lamp', 'Monitor', 'Keyboard', 'Router', 'License', 'Chair', 'Cable', 'Dock', 'Headset'])[1 + floor(random() * 10)::int]
      || ' ' || (array['Basic', 'Pro', 'Max', 'Mini', 'Plus'])[1 + floor(random() * 5)::int] as name,
    1 + floor(random() * p.suppliers)::int as supplier_id,
    500 + floor(power(random(), 2) * 99500)::int as price,
    0.4 + random() * 0.35 as cost_share,
    random() < 0.06 as discontinued,
    30 + floor(random() * (5 * 365 - 30)) as age_days, -- launched 30 days to 5 years ago
    1 + g % n.categories as k
  from seed_params p, n_lookups n, generate_series(1, p.products) g
  offset 0
) d
join public.product_categories c on c.sort_order = d.k
order by d.g;

-- Daily rates: a slow wave plus noise around a base, covering every order day.
insert into public.exchange_rates (day, currency, usd_rate)
select d::date, b.currency,
  case when b.currency = 'USD' then 1
       else round((b.base * (1 + 0.04 * sin(extract(julian from d) / 37.0 + b.phase) + 0.01 * (random() - 0.5)))::numeric, 6) end
from seed_params p,
  generate_series((now() at time zone 'UTC')::date - p.span - interval '2 days', (now() at time zone 'UTC')::date + 1, interval '1 day') d,
  (values ('USD', 1.0, 0.0), ('EUR', 1.08, 1.0), ('ILS', 0.27, 2.0), ('GBP', 1.27, 3.0)) b(currency, base, phase);

-- Random draws live in offset-0 subqueries: one evaluation per generated row, never shared or re-run.
insert into public.customers (name, email, country, segment, active, created_at)
select
  d.name,
  lower(replace(d.name, ' ', '.')) || '.' || d.g || '@example.com',
  c.code,
  case when d.seg < 0.15 then 'enterprise' when d.seg < 0.6 then 'business' else 'starter' end,
  d.active,
  d.created_at
from (
  select
    g,
    (array['Cedar', 'Harbor', 'Northwind', 'Juniper', 'Atlas', 'Lumen', 'Granite', 'Willow', 'Copper', 'Meridian', 'Saffron', 'Tidal'])[1 + floor(random() * 12)::int]
      || ' '
      || (array['Studio', 'Books', 'Cafe', 'Labs', 'Supply', 'Travel', 'Foods', 'Design', 'Motors', 'Health', 'Market', 'Systems'])[1 + floor(random() * 12)::int] as name,
    1 + floor(random() * n.countries)::int as k,
    random() as seg,
    random() > 0.12 as active,
    now() - p.span - random() * interval '2 years' as created_at
  from seed_params p, n_lookups n, generate_series(1, p.customers) g
  offset 0
) d
join public.countries c on c.sort_order = d.k
order by d.g;

-- One default address per customer, plus a second one for ~40%.
insert into public.addresses (customer_id, city, postal_code, country, is_default)
select c.id, 'City ' || floor(random() * 500)::int, lpad(floor(random() * 100000)::int::text, 5, '0'), c.country, true
from public.customers c;
insert into public.addresses (customer_id, city, postal_code, country, is_default)
select c.id, 'City ' || floor(random() * 500)::int, lpad(floor(random() * 100000)::int::text, 5, '0'), c.country, false
from public.customers c
where random() < 0.4;

-- Team by id % 10: 1-6 sales, 7-9 support, 0 operations.
insert into public.employees (full_name, email, team, region)
select
  (array['Noa', 'Amir', 'Lena', 'Omar', 'Maya', 'Jonas', 'Tamar', 'Felix'])[1 + floor(random() * 8)::int] || ' '
    || (array['Cohen', 'Levi', 'Haddad', 'Muller', 'Rossi', 'Kim', 'Silva', 'Brown'])[1 + floor(random() * 8)::int],
  'employee.' || g || '@example.com',
  case when g % 10 between 1 and 6 then 'sales' when g % 10 between 7 and 9 then 'support' else 'operations' end,
  r.code
from seed_params p
cross join n_lookups n
cross join generate_series(1, p.employees) g
join public.regions r on r.sort_order = 1 + g % n.regions
order by g;

insert into public.marketing_campaigns (name, channel, budget_usd_cents, starts_at, ends_at)
select d.name, d.channel, d.budget, d.starts_at, d.starts_at + d.days * interval '1 day'
from (
  select
    'Campaign ' || g as name,
    (array['search', 'social', 'email', 'affiliate', 'display'])[1 + floor(random() * 5)::int] as channel,
    (1000 + floor(random() * 199000))::bigint * 100 as budget,
    now() - random() * p.span as starts_at,
    7 + floor(random() * 54) as days
  from seed_params p, generate_series(1, p.campaigns) g
  offset 0
) d;

-- power(random(), k) skews toward low ids: some customers and products are far more active than others.
insert into public.web_sessions (customer_id, campaign_id, device, page_views, converted, started_at)
select
  case when random() < 0.6 then 1 + floor(p.customers * power(random(), 1.5))::bigint end,
  case when random() < 0.35 then 1 + floor(random() * p.campaigns)::int end,
  (array['desktop', 'desktop', 'mobile', 'mobile', 'mobile', 'tablet'])[1 + floor(random() * 6)::int],
  1 + floor(power(random(), 2) * 30)::int,
  random() < 0.06,
  now() - random() * p.span
from seed_params p, generate_series(1, p.sessions);

-- Orders are planned in temp tables first so totals and item counts are known before the insert.
create temp table tmp_orders as
with draw as materialized (
  select
    g as id,
    1 + floor(p.customers * power(random(), 1.5))::bigint as customer_id,
    now() - random() * p.span as created_at,
    random() as ch, random() as st, random() as disc, random() as wh, random() as camp, random() as agent_k, random() as agent_n,
    random() as exp, random() as prod, 1 + floor(random() * 5)::int as n_items
  from seed_params p, generate_series(1, p.orders) g
)
select
  d.id,
  d.customer_id,
  a.id as address_id,
  -- a warehouse in the customer's region (see the warehouses insert)
  r.sort_order + n.regions * floor(d.wh * p.warehouses_per_region)::int as warehouse_id,
  -- a sales employee: id = 10k + (1..6)
  10 * floor(d.agent_k * (p.employees / 10))::int + 1 + floor(d.agent_n * 6)::int as agent_id,
  case when d.camp < 0.3 then 1 + floor(d.camp / 0.3 * p.campaigns)::int end as campaign_id,
  -- channel weights from src/data/seed.ts: 50, 28, 12, 10
  case when d.ch < 0.5 then 'web' when d.ch < 0.78 then 'mobile' when d.ch < 0.9 then 'phone' else 'partner' end as channel,
  -- status weights from src/data/seed.ts: 52, 14, 12, 9, 8, 5
  case when d.st < 0.52 then 'delivered' when d.st < 0.66 then 'shipped' when d.st < 0.78 then 'processing'
       when d.st < 0.87 then 'late' when d.st < 0.95 then 'cancelled' else 'returned' end as status,
  co.currency,
  case when d.disc > 0.6 then (1 + floor((d.disc - 0.6) / 0.4 * 6)::int) * 5 else 0 end as discount_pct,
  d.exp > 0.75 as express,
  d.created_at,
  floor(p.products * power(d.prod, 2))::bigint as product_base,
  d.n_items
from draw d
cross join seed_params p
cross join n_lookups n
join public.customers c on c.id = d.customer_id
join public.countries co on co.code = c.country
join public.regions r on r.code = co.region
join public.addresses a on a.customer_id = c.id and a.is_default;

-- 1 to 5 distinct products per order: (base + n * 7919) mod products is distinct for n = 1..5
-- because 7919 is prime, so it never divides a product count above 4.
create temp table tmp_items as
select
  o.id as order_id,
  pr.id as product_id,
  1 + floor(power(random(), 2) * 20)::int as quantity,
  greatest(1, round(pr.price_usd_cents / er.usd_rate))::int as unit_price_cents
from tmp_orders o
cross join seed_params p
cross join lateral generate_series(1, o.n_items) n
join public.products pr on pr.id = 1 + (o.product_base + n * 7919) % p.products
join public.exchange_rates er on er.day = (o.created_at at time zone 'UTC')::date and er.currency = o.currency;

insert into public.orders (
  id, customer_id, address_id, warehouse_id, agent_id, campaign_id, channel, status, currency,
  total_cents, item_count, discount_pct, express, created_at
)
overriding system value
select
  o.id, o.customer_id, o.address_id, o.warehouse_id, o.agent_id, o.campaign_id, o.channel, o.status, o.currency,
  round(t.subtotal * (100 - o.discount_pct) / 100.0)::bigint, t.items, o.discount_pct, o.express, o.created_at
from tmp_orders o
join (
  select order_id, sum(quantity::bigint * unit_price_cents) as subtotal, sum(quantity)::int as items
  from tmp_items group by order_id
) t on t.order_id = o.id;
select setval(pg_get_serial_sequence('public.orders', 'id'), (select max(id) from public.orders));

insert into public.order_items (order_id, product_id, quantity, unit_price_cents)
select order_id, product_id, quantity, unit_price_cents from tmp_items;

drop table tmp_items;
drop table tmp_orders;

-- Invoices for every order that was not cancelled. Weights from src/data/seed-extra.ts:
-- status 70/15/12/3 (paid, open, overdue, void), method 55/30/12/3 (card, transfer, paypal, cash).
insert into public.invoices (order_id, status, issued_on, due_on, paid_on, net_cents, tax_pct, total_cents, method, reminded)
select
  d.order_id,
  st.status,
  d.issued_on,
  d.issued_on + d.terms_days,
  case when st.status = 'paid' then least(current_date, d.issued_on + d.paid_after) end,
  d.net_cents,
  d.tax_pct,
  round(d.net_cents * (100 + d.tax_pct) / 100.0)::bigint,
  case when st.status = 'paid' then
    case when d.m < 0.55 then 'card' when d.m < 0.85 then 'transfer' when d.m < 0.97 then 'paypal' else 'cash' end
  end,
  st.status = 'overdue' or (st.status = 'open' and d.remind > 0.6)
from (
  select
    o.id as order_id,
    (o.created_at at time zone 'UTC')::date as issued_on,
    o.total_cents as net_cents,
    random() as s,
    (array[14, 30, 45])[1 + floor(random() * 3)::int] as terms_days,
    floor(random() * 41)::int as paid_after,
    (array[0, 17, 18, 20])[1 + floor(random() * 4)::int] as tax_pct,
    random() as m,
    random() as remind
  from public.orders o
  where o.status <> 'cancelled'
  offset 0
) d
cross join lateral (
  select case when d.s < 0.7 then 'paid' when d.s < 0.85 then 'open' when d.s < 0.97 then 'overdue' else 'void' end as status
) st;

-- Payments: cancelled orders may have one failed attempt; every other order has one payment
-- (refunded if returned, captured for 92%, else still authorized), and ~4% also had a failed attempt first.
insert into public.payments (order_id, method, status, amount_cents, created_at)
select o.id, x.method, x.status, o.total_cents, x.created_at
from public.orders o
cross join lateral (
  select
    (array['card', 'card', 'card', 'transfer', 'paypal', 'cash'])[1 + floor(random() * 6)::int] as method,
    case when o.status = 'cancelled' then 'failed'
         when o.status = 'returned' then 'refunded'
         when random() < 0.92 then 'captured'
         else 'authorized' end as status,
    least(now(), o.created_at + random() * interval '5 days') as created_at,
    random() as keep
  offset 0
) x
where o.status <> 'cancelled' or x.keep < 0.5
union all
select o.id, 'card', 'failed', o.total_cents, o.created_at
from public.orders o
where o.status <> 'cancelled' and random() < 0.04;

-- Shipments for every order that left the warehouse. The shipment status follows the order:
-- delivered -> delivered, returned -> returned, late -> delayed, shipped -> in transit (2% lost).
-- Carrier weights 30/30/25/15; promise 1-3 days for express, else 3-10; 20% of arrivals are 1-4 days late.
insert into public.shipments (order_id, warehouse_id, carrier, status, shipped_at, promised_on, delivered_at, weight_grams, cost_cents)
select
  d.id, d.warehouse_id,
  case when d.c < 0.3 then 'dhl' when d.c < 0.6 then 'ups' when d.c < 0.85 then 'fedex' else 'local' end,
  d.shipment_status,
  d.shipped_at,
  (d.shipped_at at time zone 'UTC')::date + d.promised_days,
  case when d.shipment_status in ('delivered', 'returned')
       then least(now(), d.shipped_at + (d.promised_days + d.delay_days) * interval '1 day') end,
  200 + floor(power(random(), 2) * 40000)::int,
  500 + floor(random() * 12000)::int
from (
  select
    o.id, o.warehouse_id,
    random() as c,
    case o.status when 'delivered' then 'delivered' when 'returned' then 'returned' when 'late' then 'delayed'
                  else case when random() < 0.02 then 'lost' else 'in_transit' end end as shipment_status,
    least(now(), o.created_at + floor(random() * 4) * interval '1 day') as shipped_at,
    case when o.express then 1 + floor(random() * 3)::int else 3 + floor(random() * 8)::int end as promised_days,
    case when random() < 0.2 then 1 + floor(random() * 4)::int else 0 end as delay_days
  from public.orders o
  where o.status in ('delivered', 'returned', 'shipped', 'late')
  offset 0
) d;

-- Returned orders send back every line.
insert into public.returns (order_id, product_id, reason, refund_cents, created_at)
select
  oi.order_id, oi.product_id,
  (array['damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'late'])[1 + floor(random() * 5)::int],
  round(oi.quantity::bigint * oi.unit_price_cents * (100 - o.discount_pct) / 100.0)::bigint,
  least(now(), s.delivered_at + (1 + random() * 19) * interval '1 day')
from public.orders o
join public.order_items oi on oi.order_id = o.id
join public.shipments s on s.order_id = o.id
where o.status = 'returned';

-- Stock profile by product id: id % 10 = 0 is out of stock everywhere; id % 10 = 1 is low stock
-- (only the first warehouse holds 1-9 units); the rest are stocked normally.
insert into public.inventory_levels (warehouse_id, product_id, on_hand, reorder_point)
select
  w.id, pr.id,
  case when pr.id % 10 = 0 then 0
       when pr.id % 10 = 1 then case when w.id = 1 then 1 + floor(random() * 9)::int else 0 end
       else floor(power(random(), 1.5) * 800)::int end,
  20 + floor(random() * 80)::int
from public.warehouses w
cross join public.products pr;

insert into public.product_reviews (product_id, customer_id, rating, created_at)
select
  d.product_id,
  d.customer_id,
  case when d.r < 0.05 then 1 when d.r < 0.1 then 2 when d.r < 0.25 then 3 when d.r < 0.55 then 4 else 5 end,
  d.created_at
from (
  select
    1 + floor(p.products * power(random(), 2))::bigint as product_id,
    1 + floor(p.customers * power(random(), 1.5))::bigint as customer_id,
    random() as r,
    now() - random() * p.span as created_at
  from seed_params p, generate_series(1, p.reviews)
  offset 0
) d;

-- Tickets are opened about real orders; 30% are general questions without the order link.
-- Weights from src/data/seed-extra.ts: channel 40/30/15/15, priority 30/45/18/7,
-- status 10/20/12/33/25. First response takes up to 1.6x the priority's SLA, so some miss it.
insert into public.support_tickets (
  customer_id, order_id, assignee_id, subject, channel, priority, status,
  opened_at, first_response_at, resolved_at, satisfaction
)
select
  t.customer_id, t.order_id, t.assignee_id, t.subject, t.channel, t.priority, t.status,
  t.opened_at,
  least(now(), t.opened_at + (0.1 + power(t.resp, 2) * tp.sla_hours * 1.6) * interval '1 hour'),
  case when t.status in ('resolved', 'closed') then least(now(), t.opened_at + (1 + floor(t.res * 240)) * interval '1 hour') end,
  case when t.status in ('resolved', 'closed') and t.rate > 0.35 then 1 + floor(t.score * 5)::int end
from (
  select
    o.customer_id,
    case when d.link < 0.7 then o.id end as order_id,
    -- a support employee: id = 10k + (7..9)
    10 * floor(d.agent_k * (p.employees / 10))::int + 7 + floor(d.agent_n * 3)::int as assignee_id,
    (array['Billing question', 'Login problem', 'Late delivery', 'Refund request', 'Damaged item', 'Feature request'])[1 + floor(d.topic * 6)::int] as subject,
    case when d.ch < 0.4 then 'email' when d.ch < 0.7 then 'chat' when d.ch < 0.85 then 'phone' else 'web' end as channel,
    case when d.pr < 0.3 then 'low' when d.pr < 0.75 then 'normal' when d.pr < 0.93 then 'high' else 'urgent' end as priority,
    case when d.st < 0.1 then 'new' when d.st < 0.3 then 'open' when d.st < 0.42 then 'pending'
         when d.st < 0.75 then 'resolved' else 'closed' end as status,
    least(now(), o.created_at + d.open_after * interval '10 days') as opened_at,
    d.resp, d.res, d.rate, d.score
  from (
    select
      1 + floor(p.orders * random())::bigint as order_id,
      random() as link, random() as agent_k, random() as agent_n, random() as topic, random() as ch,
      random() as pr, random() as st, random() as open_after, random() as resp, random() as res,
      random() as rate, random() as score
    from seed_params p, generate_series(1, p.tickets)
    offset 0
  ) d
  cross join seed_params p
  join public.orders o on o.id = d.order_id
) t
join public.ticket_priorities tp on tp.code = t.priority;

analyze;

select reports.refresh_all();
select reports.check_lookup_values();
