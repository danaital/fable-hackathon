-- Primary (OLTP) schema for Bahir's synthetic data: a B2B retailer. Customers browse (web_sessions),
-- order products shipped from regional warehouses, are invoiced and pay in one of four currencies,
-- receive shipments, return items, review products and open support tickets handled by employees.
--
-- Every coded value (status, channel, currency, ...) is a row in a lookup table with en/he labels
-- and a badge tone, and fact tables reference it by foreign key. Codes and labels match the app
-- (src/data/reports.ts, src/i18n/messages/core.*.ts).
-- RLS is on for every table with no policies, so anon/authenticated clients read nothing
-- until a slice adds explicit policies; server code uses the service role or the Postgres URL.

create domain public.tone as text check (value in ('success', 'warning', 'danger', 'info', 'neutral'));

-- Lookup tables: same shape for every coded value set. Retire a code with active = false, never delete it.
do $$
declare
  t text;
begin
  foreach t in array array[
    'regions', 'currencies', 'countries', 'sales_channels', 'order_statuses', 'customer_segments',
    'invoice_statuses', 'payment_methods', 'payment_statuses', 'carriers', 'shipment_statuses',
    'return_reasons', 'ticket_channels', 'ticket_priorities', 'ticket_statuses', 'product_categories',
    'stock_statuses', 'device_types', 'marketing_channels', 'employee_teams'
  ] loop
    execute format(
      'create table public.%I (
         code text primary key,
         label_en text not null,
         label_he text not null,
         tone public.tone not null default ''neutral'',
         sort_order smallint not null,
         active boolean not null default true
       )', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- A country belongs to a sales region and bills in one currency.
alter table public.countries
  add column region text not null references public.regions (code),
  add column currency text not null references public.currencies (code);

insert into public.regions (code, label_en, label_he, sort_order) values
  ('NA', 'North America', 'צפון אמריקה', 1),
  ('LATAM', 'Latin America', 'אמריקה הלטינית', 2),
  ('EU', 'Europe', 'אירופה', 3),
  ('UK', 'United Kingdom', 'בריטניה', 4),
  ('MEA', 'Middle East & Africa', 'המזרח התיכון ואפריקה', 5),
  ('APAC', 'Asia Pacific', 'אסיה והפסיפיק', 6);

insert into public.currencies (code, label_en, label_he, sort_order) values
  ('USD', 'US dollar', 'דולר אמריקאי', 1),
  ('EUR', 'Euro', 'אירו', 2),
  ('ILS', 'Israeli shekel', 'שקל חדש', 3),
  ('GBP', 'British pound', 'לירה שטרלינג', 4);

insert into public.countries (code, label_en, label_he, sort_order, region, currency) values
  ('IL', 'Israel', 'ישראל', 1, 'MEA', 'ILS'),
  ('US', 'United States', 'ארצות הברית', 2, 'NA', 'USD'),
  ('DE', 'Germany', 'גרמניה', 3, 'EU', 'EUR'),
  ('FR', 'France', 'צרפת', 4, 'EU', 'EUR'),
  ('GB', 'United Kingdom', 'בריטניה', 5, 'UK', 'GBP'),
  ('ES', 'Spain', 'ספרד', 6, 'EU', 'EUR'),
  ('IT', 'Italy', 'איטליה', 7, 'EU', 'EUR'),
  ('NL', 'Netherlands', 'הולנד', 8, 'EU', 'EUR'),
  ('JP', 'Japan', 'יפן', 9, 'APAC', 'USD'),
  ('BR', 'Brazil', 'ברזיל', 10, 'LATAM', 'USD');

insert into public.sales_channels (code, label_en, label_he, sort_order) values
  ('web', 'Web', 'אתר', 1),
  ('mobile', 'Mobile app', 'אפליקציה', 2),
  ('phone', 'Phone', 'טלפון', 3),
  ('partner', 'Partner', 'שותף', 4);

insert into public.order_statuses (code, label_en, label_he, tone, sort_order) values
  ('delivered', 'Delivered', 'נמסר', 'success', 1),
  ('shipped', 'Shipped', 'נשלח', 'info', 2),
  ('processing', 'Processing', 'בטיפול', 'neutral', 3),
  ('late', 'Late', 'באיחור', 'warning', 4),
  ('cancelled', 'Cancelled', 'בוטל', 'danger', 5),
  ('returned', 'Returned', 'הוחזר', 'neutral', 6);

insert into public.customer_segments (code, label_en, label_he, sort_order) values
  ('enterprise', 'Enterprise', 'ארגוני', 1),
  ('business', 'Business', 'עסקי', 2),
  ('starter', 'Starter', 'מתחיל', 3);

insert into public.invoice_statuses (code, label_en, label_he, tone, sort_order) values
  ('paid', 'Paid', 'שולם', 'success', 1),
  ('open', 'Open', 'פתוח', 'info', 2),
  ('overdue', 'Overdue', 'באיחור', 'warning', 3),
  ('void', 'Void', 'מבוטל', 'neutral', 4);

insert into public.payment_methods (code, label_en, label_he, sort_order) values
  ('card', 'Card', 'כרטיס אשראי', 1),
  ('transfer', 'Bank transfer', 'העברה בנקאית', 2),
  ('paypal', 'PayPal', 'PayPal', 3),
  ('cash', 'Cash', 'מזומן', 4);

insert into public.payment_statuses (code, label_en, label_he, tone, sort_order) values
  ('authorized', 'Authorized', 'מאושר', 'info', 1),
  ('captured', 'Captured', 'נגבה', 'success', 2),
  ('failed', 'Failed', 'נכשל', 'danger', 3),
  ('refunded', 'Refunded', 'הוחזר', 'neutral', 4);

insert into public.carriers (code, label_en, label_he, sort_order) values
  ('dhl', 'DHL', 'DHL', 1),
  ('ups', 'UPS', 'UPS', 2),
  ('fedex', 'FedEx', 'FedEx', 3),
  ('local', 'Local courier', 'שליח מקומי', 4);

insert into public.shipment_statuses (code, label_en, label_he, tone, sort_order) values
  ('in_transit', 'In transit', 'בדרך', 'info', 1),
  ('delivered', 'Delivered', 'נמסר', 'success', 2),
  ('delayed', 'Delayed', 'מתעכב', 'warning', 3),
  ('lost', 'Lost', 'אבד', 'danger', 4),
  ('returned', 'Returned', 'הוחזר', 'neutral', 5);

insert into public.return_reasons (code, label_en, label_he, sort_order) values
  ('damaged', 'Damaged', 'פגום', 1),
  ('wrong_item', 'Wrong item', 'פריט שגוי', 2),
  ('not_as_described', 'Not as described', 'לא כמתואר', 3),
  ('changed_mind', 'Changed mind', 'שינוי דעה', 4),
  ('late', 'Arrived late', 'הגיע באיחור', 5);

insert into public.ticket_channels (code, label_en, label_he, sort_order) values
  ('email', 'Email', 'אימייל', 1),
  ('chat', 'Chat', 'צ׳אט', 2),
  ('phone', 'Phone', 'טלפון', 3),
  ('web', 'Web form', 'טופס באתר', 4);

-- sla_hours: the first-response target for tickets of this priority (reports.tickets "slaMet").
alter table public.ticket_priorities add column sla_hours smallint not null check (sla_hours > 0);

insert into public.ticket_priorities (code, label_en, label_he, tone, sort_order, sla_hours) values
  ('low', 'Low', 'נמוכה', 'neutral', 1, 72),
  ('normal', 'Normal', 'רגילה', 'info', 2, 48),
  ('high', 'High', 'גבוהה', 'warning', 3, 24),
  ('urgent', 'Urgent', 'דחופה', 'danger', 4, 4);

insert into public.ticket_statuses (code, label_en, label_he, tone, sort_order) values
  ('new', 'New', 'חדשה', 'info', 1),
  ('open', 'Open', 'פתוחה', 'info', 2),
  ('pending', 'Waiting on customer', 'ממתינה ללקוח', 'warning', 3),
  ('resolved', 'Resolved', 'נפתרה', 'success', 4),
  ('closed', 'Closed', 'סגורה', 'neutral', 5);

insert into public.product_categories (code, label_en, label_he, sort_order) values
  ('hardware', 'Hardware', 'חומרה', 1),
  ('software', 'Software', 'תוכנה', 2),
  ('accessories', 'Accessories', 'אביזרים', 3),
  ('services', 'Services', 'שירותים', 4),
  ('furniture', 'Furniture', 'ריהוט', 5);

insert into public.stock_statuses (code, label_en, label_he, tone, sort_order) values
  ('in_stock', 'In stock', 'במלאי', 'success', 1),
  ('low_stock', 'Low stock', 'מלאי נמוך', 'warning', 2),
  ('out_of_stock', 'Out of stock', 'אזל מהמלאי', 'danger', 3),
  ('discontinued', 'Discontinued', 'הופסק', 'neutral', 4);

insert into public.device_types (code, label_en, label_he, sort_order) values
  ('desktop', 'Desktop', 'מחשב', 1),
  ('mobile', 'Mobile', 'נייד', 2),
  ('tablet', 'Tablet', 'טאבלט', 3);

insert into public.marketing_channels (code, label_en, label_he, sort_order) values
  ('search', 'Search', 'חיפוש', 1),
  ('social', 'Social', 'רשתות חברתיות', 2),
  ('email', 'Email', 'אימייל', 3),
  ('affiliate', 'Affiliate', 'שותפים', 4),
  ('display', 'Display', 'באנרים', 5);

insert into public.employee_teams (code, label_en, label_he, sort_order) values
  ('sales', 'Sales', 'מכירות', 1),
  ('support', 'Support', 'תמיכה', 2),
  ('operations', 'Operations', 'תפעול', 3);

-- Fact and entity tables -----------------------------------------------------------------------

create table public.warehouses (
  id integer generated always as identity primary key,
  code text not null unique,
  region text not null references public.regions (code),
  city text not null
);

create table public.suppliers (
  id integer generated always as identity primary key,
  name text not null,
  country text not null references public.countries (code)
);

create table public.products (
  id bigint generated always as identity primary key,
  sku text not null unique,
  name text not null,
  category text not null references public.product_categories (code),
  supplier_id integer not null references public.suppliers (id),
  price_usd_cents integer not null check (price_usd_cents > 0),
  cost_usd_cents integer not null check (cost_usd_cents > 0),
  discontinued boolean not null default false,
  created_at timestamptz not null default now()
);

-- USD value of one unit of each currency per day; converts order amounts for reports.
create table public.exchange_rates (
  day date not null,
  currency text not null references public.currencies (code),
  usd_rate numeric(12, 6) not null check (usd_rate > 0),
  primary key (day, currency)
);

create table public.customers (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null unique,
  country text not null references public.countries (code),
  segment text not null references public.customer_segments (code),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.addresses (
  id bigint generated always as identity primary key,
  customer_id bigint not null references public.customers (id) on delete cascade,
  city text not null,
  postal_code text not null,
  country text not null references public.countries (code),
  is_default boolean not null default false
);

create table public.employees (
  id integer generated always as identity primary key,
  full_name text not null,
  email text not null unique,
  team text not null references public.employee_teams (code),
  region text not null references public.regions (code)
);

create table public.marketing_campaigns (
  id integer generated always as identity primary key,
  name text not null,
  channel text not null references public.marketing_channels (code),
  budget_usd_cents bigint not null check (budget_usd_cents >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);

create table public.web_sessions (
  id bigint generated always as identity primary key,
  customer_id bigint references public.customers (id) on delete set null,
  campaign_id integer references public.marketing_campaigns (id),
  device text not null references public.device_types (code),
  page_views integer not null check (page_views > 0),
  converted boolean not null,
  started_at timestamptz not null
);

-- total_cents (order currency, after discount) and item_count are kept on the row so order lists never re-sum items.
create table public.orders (
  id bigint generated always as identity primary key,
  customer_id bigint not null references public.customers (id),
  address_id bigint not null references public.addresses (id),
  warehouse_id integer not null references public.warehouses (id),
  agent_id integer references public.employees (id),
  campaign_id integer references public.marketing_campaigns (id),
  channel text not null references public.sales_channels (code),
  status text not null default 'processing' references public.order_statuses (code),
  currency text not null references public.currencies (code),
  total_cents bigint not null check (total_cents >= 0),
  item_count integer not null check (item_count > 0),
  discount_pct smallint not null default 0 check (discount_pct between 0 and 100),
  express boolean not null default false,
  created_at timestamptz not null default now()
);

-- unit_price_cents is in the order's currency, before the order-level discount.
create table public.order_items (
  order_id bigint not null references public.orders (id) on delete cascade,
  product_id bigint not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents > 0),
  primary key (order_id, product_id)
);

-- One invoice per order, in the order's currency.
create table public.invoices (
  id bigint generated always as identity primary key,
  order_id bigint not null unique references public.orders (id) on delete cascade,
  status text not null references public.invoice_statuses (code),
  issued_on date not null,
  due_on date not null,
  paid_on date,
  net_cents bigint not null check (net_cents >= 0),
  tax_pct smallint not null check (tax_pct between 0 and 100),
  total_cents bigint not null check (total_cents >= 0),
  method text references public.payment_methods (code),
  reminded boolean not null default false,
  check (due_on >= issued_on),
  check (paid_on is null or paid_on >= issued_on)
);

create table public.payments (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  method text not null references public.payment_methods (code),
  status text not null references public.payment_statuses (code),
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null
);

-- cost_cents is in the order's currency.
create table public.shipments (
  id bigint generated always as identity primary key,
  order_id bigint not null unique references public.orders (id) on delete cascade,
  warehouse_id integer not null references public.warehouses (id),
  carrier text not null references public.carriers (code),
  status text not null references public.shipment_statuses (code),
  shipped_at timestamptz not null,
  promised_on date not null,
  delivered_at timestamptz,
  weight_grams integer not null check (weight_grams > 0),
  cost_cents integer not null check (cost_cents >= 0),
  check (delivered_at is null or delivered_at >= shipped_at)
);

create table public.returns (
  id bigint generated always as identity primary key,
  order_id bigint not null,
  product_id bigint not null,
  reason text not null references public.return_reasons (code),
  refund_cents bigint not null check (refund_cents >= 0),
  created_at timestamptz not null,
  foreign key (order_id, product_id) references public.order_items (order_id, product_id) on delete cascade
);

create table public.inventory_levels (
  warehouse_id integer not null references public.warehouses (id),
  product_id bigint not null references public.products (id),
  on_hand integer not null check (on_hand >= 0),
  reorder_point integer not null check (reorder_point >= 0),
  primary key (warehouse_id, product_id)
);

create table public.product_reviews (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id),
  customer_id bigint not null references public.customers (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null
);

create table public.support_tickets (
  id bigint generated always as identity primary key,
  customer_id bigint not null references public.customers (id) on delete cascade,
  order_id bigint references public.orders (id) on delete set null,
  assignee_id integer references public.employees (id),
  subject text not null,
  channel text not null references public.ticket_channels (code),
  priority text not null references public.ticket_priorities (code),
  status text not null references public.ticket_statuses (code),
  opened_at timestamptz not null,
  first_response_at timestamptz not null,
  resolved_at timestamptz,
  satisfaction smallint check (satisfaction between 1 and 5),
  check (first_response_at >= opened_at),
  check (resolved_at is null or resolved_at >= opened_at)
);

-- Foreign keys to entity tables are indexed (unless they lead a primary/unique key), plus the time
-- columns reports filter on. Foreign keys to lookup tables are not: the parents are tiny and never deleted.
create index addresses_customer_id_idx on public.addresses (customer_id);
create unique index addresses_one_default_idx on public.addresses (customer_id) where is_default;
create index products_supplier_id_idx on public.products (supplier_id);
create index web_sessions_customer_id_idx on public.web_sessions (customer_id);
create index web_sessions_campaign_id_idx on public.web_sessions (campaign_id);
create index web_sessions_started_at_idx on public.web_sessions (started_at);
create index orders_customer_id_idx on public.orders (customer_id);
create index orders_address_id_idx on public.orders (address_id);
create index orders_warehouse_id_idx on public.orders (warehouse_id);
create index orders_agent_id_idx on public.orders (agent_id);
create index orders_campaign_id_idx on public.orders (campaign_id);
create index orders_created_at_idx on public.orders (created_at);
create index order_items_product_id_idx on public.order_items (product_id);
create index payments_order_id_idx on public.payments (order_id);
create index shipments_warehouse_id_idx on public.shipments (warehouse_id);
create index returns_order_product_idx on public.returns (order_id, product_id);
create index inventory_levels_product_id_idx on public.inventory_levels (product_id);
create index product_reviews_product_id_idx on public.product_reviews (product_id);
create index product_reviews_customer_id_idx on public.product_reviews (customer_id);
create index support_tickets_customer_id_idx on public.support_tickets (customer_id);
create index support_tickets_order_id_idx on public.support_tickets (order_id);
create index support_tickets_assignee_id_idx on public.support_tickets (assignee_id);
create index support_tickets_opened_at_idx on public.support_tickets (opened_at);

alter table public.warehouses enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.customers enable row level security;
alter table public.addresses enable row level security;
alter table public.employees enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.web_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;
alter table public.returns enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.product_reviews enable row level security;
alter table public.support_tickets enable row level security;
