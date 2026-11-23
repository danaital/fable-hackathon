-- Report metadata, normalized: one row per report and one per field, mirroring REPORTS in
-- src/data/reports.ts (ids, field keys, order, types, icons, tags) with the app's en/he labels.
-- Enum and status fields name the lookup table that holds their codes, labels and badge tones.
-- No row counts are stored: the app learns a report's size only by fetching its rows.

create table reports.reports (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{0,40}$'), -- same rule as the rows API route
  source regclass not null, -- the view that returns this report's rows
  -- icon and tags mirror REPORT_ICONS and TAGS in src/data/types.ts
  icon text not null check (icon in ('orders', 'customers', 'invoices', 'shipments', 'tickets', 'products')),
  tags text[] not null check (
    cardinality(tags) > 0
    and tags <@ array['sales', 'operations', 'finance', 'customers', 'support', 'inventory']
  ),
  title_en text not null,
  title_he text not null,
  desc_en text not null,
  desc_he text not null,
  sort_order smallint not null,
  active boolean not null default true
);

create table reports.report_fields (
  report_id text not null references reports.reports (id) on delete cascade,
  key text not null,
  position smallint not null,
  -- mirrors FIELD_TYPES in src/data/types.ts
  type text not null check (type in ('string', 'number', 'currency', 'percent', 'date', 'datetime',
                                     'boolean', 'enum', 'status', 'country', 'email')),
  label_en text not null,
  label_he text not null,
  lookup_table regclass, -- codes, labels and tones for enum, status and country values
  currency_key text, -- the row field holding the ISO currency code of a currency field
  primary key (report_id, key),
  unique (report_id, position),
  check (type not in ('enum', 'status') or lookup_table is not null),
  check ((type = 'currency') = (currency_key is not null))
);

alter table reports.reports enable row level security;
alter table reports.report_fields enable row level security;

insert into reports.reports (id, source, icon, tags, title_en, title_he, desc_en, desc_he, sort_order) values
  ('orders', 'reports.orders', 'orders', array['sales', 'operations', 'finance'],
   'Orders', 'הזמנות',
   'Every order with its status, dates and amounts.', 'כל הזמנה עם הסטטוס, התאריכים והסכומים שלה.', 1),
  ('customers', 'reports.customers', 'customers', array['customers', 'sales'],
   'Customers', 'לקוחות',
   'Customer accounts with segment, activity and lifetime value.', 'חשבונות לקוחות עם פלח, פעילות ושווי מצטבר.', 2),
  ('invoices', 'reports.invoices', 'invoices', array['finance', 'customers'],
   'Invoices', 'חשבוניות',
   'Invoices with due dates, tax, totals and payment status.', 'חשבוניות עם מועדי תשלום, מע״מ, סכומים וסטטוס תשלום.', 3),
  ('shipments', 'reports.shipments', 'shipments', array['operations'],
   'Shipments', 'משלוחים',
   'Every shipment with carrier, promised and actual delivery, and delays.', 'כל משלוח עם חברת השילוח, מועד מסירה מובטח ובפועל, ועיכובים.', 4),
  ('tickets', 'reports.tickets', 'tickets', array['support', 'customers'],
   'Support tickets', 'פניות תמיכה',
   'Customer support tickets with priority, response time and satisfaction.', 'פניות שירות לקוחות עם דחיפות, זמן תגובה ושביעות רצון.', 5),
  ('products', 'reports.products', 'products', array['inventory', 'sales'],
   'Products', 'מוצרים',
   'Product catalog with stock, cost, price, margin and sales.', 'קטלוג מוצרים עם מלאי, עלות, מחיר, רווחיות ומכירות.', 6);

insert into reports.report_fields (report_id, position, key, type, label_en, label_he, lookup_table, currency_key) values
  ('orders', 1, 'orderId', 'string', 'Order', 'הזמנה', null, null),
  ('orders', 2, 'customer', 'string', 'Customer', 'לקוח', null, null),
  ('orders', 3, 'country', 'country', 'Country', 'מדינה', 'public.countries', null),
  ('orders', 4, 'channel', 'enum', 'Channel', 'ערוץ', 'public.sales_channels', null),
  ('orders', 5, 'status', 'status', 'Status', 'סטטוס', 'public.order_statuses', null),
  ('orders', 6, 'orderDate', 'date', 'Order date', 'תאריך הזמנה', null, null),
  ('orders', 7, 'deliveryDate', 'date', 'Delivery date', 'תאריך מסירה', null, null),
  ('orders', 8, 'paidAt', 'datetime', 'Paid at', 'מועד תשלום', null, null),
  ('orders', 9, 'amount', 'currency', 'Amount', 'סכום', null, 'currency'),
  ('orders', 10, 'currency', 'enum', 'Currency', 'מטבע', 'public.currencies', null),
  ('orders', 11, 'items', 'number', 'Items', 'פריטים', null, null),
  ('orders', 12, 'discountPct', 'percent', 'Discount', 'הנחה', null, null),
  ('orders', 13, 'express', 'boolean', 'Express', 'אקספרס', null, null),
  ('orders', 14, 'agent', 'string', 'Agent', 'נציג', null, null),
  ('orders', 15, 'email', 'email', 'Email', 'אימייל', null, null),

  ('customers', 1, 'customerId', 'string', 'Customer ID', 'מזהה לקוח', null, null),
  ('customers', 2, 'name', 'string', 'Name', 'שם', null, null),
  ('customers', 3, 'country', 'country', 'Country', 'מדינה', 'public.countries', null),
  ('customers', 4, 'segment', 'enum', 'Segment', 'פלח', 'public.customer_segments', null),
  ('customers', 5, 'since', 'date', 'Customer since', 'לקוח מאז', null, null),
  ('customers', 6, 'orders', 'number', 'Orders', 'הזמנות', null, null),
  ('customers', 7, 'lifetimeValue', 'currency', 'Lifetime value', 'שווי מצטבר', null, 'currency'),
  ('customers', 8, 'active', 'boolean', 'Active', 'פעיל', null, null),
  ('customers', 9, 'email', 'email', 'Email', 'אימייל', null, null),

  ('invoices', 1, 'invoiceId', 'string', 'Invoice', 'חשבונית', null, null),
  ('invoices', 2, 'orderId', 'string', 'Order', 'הזמנה', null, null),
  ('invoices', 3, 'customer', 'string', 'Customer', 'לקוח', null, null),
  ('invoices', 4, 'country', 'country', 'Country', 'מדינה', 'public.countries', null),
  ('invoices', 5, 'status', 'status', 'Status', 'סטטוס', 'public.invoice_statuses', null),
  ('invoices', 6, 'issuedOn', 'date', 'Issued on', 'תאריך הפקה', null, null),
  ('invoices', 7, 'dueOn', 'date', 'Due on', 'לתשלום עד', null, null),
  ('invoices', 8, 'paidOn', 'date', 'Paid on', 'שולם בתאריך', null, null),
  ('invoices', 9, 'net', 'currency', 'Net amount', 'סכום נטו', null, 'currency'),
  ('invoices', 10, 'taxPct', 'percent', 'Tax', 'מע״מ', null, null),
  ('invoices', 11, 'total', 'currency', 'Total', 'סה״כ', null, 'currency'),
  ('invoices', 12, 'currency', 'enum', 'Currency', 'מטבע', 'public.currencies', null),
  ('invoices', 13, 'method', 'enum', 'Payment method', 'אמצעי תשלום', 'public.payment_methods', null),
  ('invoices', 14, 'reminded', 'boolean', 'Reminder sent', 'נשלחה תזכורת', null, null),

  ('shipments', 1, 'shipmentId', 'string', 'Shipment', 'משלוח', null, null),
  ('shipments', 2, 'orderId', 'string', 'Order', 'הזמנה', null, null),
  ('shipments', 3, 'carrier', 'enum', 'Carrier', 'חברת שילוח', 'public.carriers', null),
  ('shipments', 4, 'destination', 'country', 'Destination', 'יעד', 'public.countries', null),
  ('shipments', 5, 'status', 'status', 'Status', 'סטטוס', 'public.shipment_statuses', null),
  ('shipments', 6, 'shippedAt', 'datetime', 'Shipped at', 'נשלח בתאריך', null, null),
  ('shipments', 7, 'promisedOn', 'date', 'Promised by', 'מובטח עד', null, null),
  ('shipments', 8, 'deliveredOn', 'date', 'Delivered on', 'נמסר בתאריך', null, null),
  ('shipments', 9, 'delayDays', 'number', 'Days late', 'ימי איחור', null, null),
  ('shipments', 10, 'weightKg', 'number', 'Weight (kg)', 'משקל (ק״ג)', null, null),
  ('shipments', 11, 'cost', 'currency', 'Shipping cost', 'עלות משלוח', null, 'currency'),
  ('shipments', 12, 'currency', 'enum', 'Currency', 'מטבע', 'public.currencies', null),
  ('shipments', 13, 'express', 'boolean', 'Express', 'אקספרס', null, null),

  ('tickets', 1, 'ticketId', 'string', 'Ticket', 'פנייה', null, null),
  ('tickets', 2, 'subject', 'string', 'Subject', 'נושא', null, null),
  ('tickets', 3, 'customer', 'string', 'Customer', 'לקוח', null, null),
  ('tickets', 4, 'country', 'country', 'Country', 'מדינה', 'public.countries', null),
  ('tickets', 5, 'channel', 'enum', 'Channel', 'ערוץ', 'public.ticket_channels', null),
  ('tickets', 6, 'priority', 'status', 'Priority', 'דחיפות', 'public.ticket_priorities', null),
  ('tickets', 7, 'status', 'status', 'Status', 'סטטוס', 'public.ticket_statuses', null),
  ('tickets', 8, 'openedAt', 'datetime', 'Opened at', 'נפתחה בתאריך', null, null),
  ('tickets', 9, 'resolvedAt', 'datetime', 'Resolved at', 'נפתרה בתאריך', null, null),
  ('tickets', 10, 'firstResponseH', 'number', 'First response (hours)', 'תגובה ראשונה (שעות)', null, null),
  ('tickets', 11, 'slaMet', 'boolean', 'Within SLA', 'בתוך SLA', null, null),
  ('tickets', 12, 'satisfaction', 'number', 'Satisfaction (1–5)', 'שביעות רצון (1–5)', null, null),
  ('tickets', 13, 'agent', 'string', 'Agent', 'נציג', null, null),
  ('tickets', 14, 'email', 'email', 'Email', 'אימייל', null, null),

  ('products', 1, 'sku', 'string', 'SKU', 'מק״ט', null, null),
  ('products', 2, 'name', 'string', 'Product', 'מוצר', null, null),
  ('products', 3, 'category', 'enum', 'Category', 'קטגוריה', 'public.product_categories', null),
  ('products', 4, 'origin', 'country', 'Made in', 'ארץ ייצור', 'public.countries', null),
  ('products', 5, 'stockStatus', 'status', 'Stock status', 'מצב מלאי', 'public.stock_statuses', null),
  ('products', 6, 'stock', 'number', 'In stock', 'במלאי', null, null),
  ('products', 7, 'cost', 'currency', 'Unit cost', 'עלות ליחידה', null, 'currency'),
  ('products', 8, 'price', 'currency', 'Price', 'מחיר', null, 'currency'),
  ('products', 9, 'currency', 'enum', 'Currency', 'מטבע', 'public.currencies', null),
  ('products', 10, 'marginPct', 'percent', 'Margin', 'רווחיות', null, null),
  ('products', 11, 'unitsSold', 'number', 'Units sold', 'יחידות שנמכרו', null, null),
  ('products', 12, 'launchedOn', 'date', 'Launched on', 'הושק בתאריך', null, null),
  ('products', 13, 'active', 'boolean', 'Active', 'פעיל', null, null);

-- Self-check: fail the migration if metadata and views disagree.
do $$
declare
  problems text;
begin
  select string_agg(problem, '; ') into problems from (
    -- every field is a column of its report's view
    select f.report_id || '.' || f.key || ': no such column in ' || r.source::text as problem
    from reports.report_fields f join reports.reports r on r.id = f.report_id
    where not exists (
      select 1 from pg_attribute a
      where a.attrelid = r.source and a.attname = f.key and a.attnum > 0 and not a.attisdropped
    )
    union all
    -- every view column is a field (the view returns exactly the report's keys)
    select r.id || ': view column ' || a.attname || ' has no field'
    from reports.reports r join pg_attribute a on a.attrelid = r.source and a.attnum > 0 and not a.attisdropped
    where not exists (select 1 from reports.report_fields f where f.report_id = r.id and f.key = a.attname)
      and not exists (select 1 from reports.report_fields f where f.report_id = r.id and f.currency_key = a.attname)
    union all
    -- currency fields point at a column holding the currency code
    select f.report_id || '.' || f.key || ': currency_key ' || f.currency_key || ' is not a column'
    from reports.report_fields f join reports.reports r on r.id = f.report_id
    where f.currency_key is not null and not exists (
      select 1 from pg_attribute a
      where a.attrelid = r.source and a.attname = f.currency_key and a.attnum > 0 and not a.attisdropped
    )
    union all
    -- lookup tables have the lookup shape
    select f.report_id || '.' || f.key || ': ' || f.lookup_table::text || ' is not a lookup table'
    from reports.report_fields f
    where f.lookup_table is not null and (
      select count(*) from pg_attribute a
      where a.attrelid = f.lookup_table and a.attname in ('code', 'label_en', 'label_he', 'tone', 'sort_order', 'active')
    ) <> 6
  ) p;
  if problems is not null then
    raise exception 'report metadata invalid: %', problems;
  end if;
end;
$$;

-- Refresh the materialized reports. concurrently: readers are never blocked (needs the unique indexes in 0002).
create function reports.refresh_all() returns void
language plpgsql
set search_path = ''
as $$
begin
  refresh materialized view concurrently reports.customers;
  refresh materialized view concurrently reports.products;
end;
$$;
revoke execute on function reports.refresh_all() from public;

-- Check that every enum, status and country value in every report exists in its lookup table.
-- The seed runs it last; run it after any data load.
create function reports.check_lookup_values() returns void
language plpgsql
set search_path = ''
as $$
declare
  f record;
  bad bigint;
  problems text := '';
begin
  for f in
    select r.source, fl.report_id, fl.key, fl.lookup_table
    from reports.report_fields fl join reports.reports r on r.id = fl.report_id
    where fl.lookup_table is not null
  loop
    -- source and lookup_table are regclass, so %s prints safely quoted names; %I quotes the key.
    execute format(
      'select count(*) from %s v where v.%I is not null and not exists (select 1 from %s l where l.code = v.%I)',
      f.source, f.key, f.lookup_table, f.key
    ) into bad;
    if bad > 0 then
      problems := problems || format('%s.%s: %s values missing from %s; ', f.report_id, f.key, bad, f.lookup_table);
    end if;
  end loop;
  if problems <> '' then
    raise exception 'report values outside their lookups: %', problems;
  end if;
end;
$$;
revoke execute on function reports.check_lookup_values() from public;

-- Nightly refresh at 02:15 UTC. Guarded so the migration also runs on plain Postgres without pg_cron.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    -- Same setup as https://supabase.com/docs/guides/cron/install
    create extension if not exists pg_cron with schema pg_catalog;
    grant usage on schema cron to postgres;
    grant all privileges on all tables in schema cron to postgres;
    perform cron.schedule('refresh-reports-nightly', '15 2 * * *', 'select reports.refresh_all()');
  end if;
end;
$$;
