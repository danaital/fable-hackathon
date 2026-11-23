---
tags:
  - hackathon
  - adr
---

# Decisions

Architecture Decision Records (ADR, Michael Nygard format). Append one entry per architecture or product trade-off. Never edit an accepted entry; supersede it with a new one.

## Template

### ADR-NNN: Short title

- Date: YYYY-MM-DD
- Status: Proposed | Accepted | Superseded by ADR-NNN
- Role: planner | implementer | human role
- Context: what forces this decision
- Decision: what we chose
- Consequences: what gets easier, what gets harder

## Records

### ADR-001: Fixed stack and seven-agent pipeline for the hackathon

- Date: 2026-11-23
- Status: Accepted
- Role: planner / human team
- Context: A 75-minute build with up to 4 people cannot afford time lost to tooling setup or
  stack debates, and `main` must stay demoable throughout. The product is unknown until the
  category is revealed at the event.
- Decision: Fix the stack — Next.js (App Router) on Vercel, Supabase (Postgres + Auth + RLS),
  styled-components with a shared theme, first-class Hebrew/English i18n with RTL, zod
  validation on the server. Fix the workflow — the seven-agent loop (planner → implementer →
  tester → reviewer + security-reviewer → debugger → docs-keeper) run per slice under the
  Ponytail smallest-complete-change discipline in CLAUDE.md. Commit the environment (plugins,
  MCP servers, hooks, agents, skills) but not the application code; scaffold the app at the
  event once the category is known.
- Consequences: Easier — identical laptops, a practiced loop, no stack bikeshedding, a
  deployable target from minute one. Harder — the stack is not negotiable mid-event, and
  teammates must know the loop and the rules beforehand. Full picture in
  [ARCHITECTURE.md](ARCHITECTURE.md).

### ADR-002: Preloaded agent skills and the repo as an Obsidian vault

- Date: 2026-11-23
- Status: Accepted
- Role: human team
- Context: Ponytail lived only as prose in CLAUDE.md, subagent reports cost main-session
  context, and the team wanted Obsidian in the flow without a second source of truth.
- Decision: Agents preload skills through `skills:` frontmatter: `ponytail:ponytail` for
  planner, implementer, and debugger; `ponytail:ponytail-review` for reviewer; `caveman`
  (now a project skill) for tester, reviewer, and debugger reports only;
  `obsidian:obsidian-markdown` for docs-keeper. security-reviewer stays plain. The repo itself
  is the Obsidian vault, with standard Markdown links, GitHub-compatible callouts, and `tags`
  on `docs/` notes, checked by `scripts/health-check.mjs`.
- Consequences: Easier — the same docs work on GitHub and in Obsidian, reports are shorter,
  and the rules are enforced by a command. Harder — caveman reports must be rephrased for
  humans, a plugin skill that is missing is silently skipped (check `claude --debug`), and
  `.claude/` stays outside the vault because Obsidian hides dot-folders.

### ADR-003: Contract-first API in docs/openapi.json

- Date: 2026-11-23
- Status: Accepted
- Role: human team
- Context: Four people build in parallel against one API, so routes need one agreed contract
  before code. The app is not scaffolded yet.
- Decision: Keep the API contract in `docs/openapi.json` (OpenAPI 3.1, JSON so Node can check
  it with no new dependency). The planner writes routes first, the implementer builds to them,
  the tester calls them, the reviewer flags drift, and the docs-keeper keeps the file in sync.
  Serving it with Swagger UI is the first API slice once the app exists.
- Consequences: Easier — parallel work against fixed shapes, and an API page for the demo.
  Harder — the contract and the zod schemas can drift; the reviewer checks this by hand until
  routes multiply, when generating the spec from zod becomes worth it.

### ADR-004: Fake primary data and a reports schema in the same Postgres

- Date: 2026-11-23
- Status: Superseded by ADR-005
- Role: backend/data
- Context: The demo needs a large, realistic dataset and fast report queries before the product
  is known, and the deployed site must reach it with no extra infrastructure.
- Decision: One Supabase Postgres, provisioned through the Vercel Marketplace (free plan,
  `iad1`, same region as Vercel functions) so its env vars land on the Vercel project. A neutral
  orders domain (`customers`, `products`, `orders`, `order_items`) with RLS on every table, filled
  by `supabase/seed.sql` using `generate_series` inside the database. Reports live in a
  `reports` schema of materialized views over one `revenue_items` view (the single definition
  of counted revenue: paid or shipped). They are refreshed concurrently by `reports.refresh_all()`,
  which pg_cron runs nightly. Reports have no anon/authenticated grants and are read by server
  code. A separate reports database was rejected: it needs a sync job and a second set of credentials.
- Consequences: Easier — one connection, reports read in milliseconds, reseeding is three
  `psql` commands, no new dependency. Harder — reports are up to a day stale unless
  `refresh_all()` is called; free-plan storage (500 MB) caps the seed scale; exposing reports
  through the Supabase REST API later needs the schema added to the exposed list plus explicit grants.

### ADR-005: Large synthetic dataset shaped by the app's report model

- Date: 2026-11-23
- Status: Superseded by ADR-006
- Role: backend/data
- Context: The user asked for far more data and tables and for the reports database to hold
  report configurations. Meanwhile the app gained its own report model (`ReportDef` in
  `src/data/types.ts`) and in-memory rows whose value sets disagreed with ADR-004's schema
  (see [Bahir data](bahir/data.md)).
- Decision: Supabase Pro plan (the free plan's 500 MB cannot hold millions of rows). A 19-table
  primary schema that uses the app's value sets. A seed whose `scale` variable sets the size;
  `scale=1` is 4M orders and about 12M order lines. Each report is one view in `reports` whose
  column names are the `ReportDef` field keys and whose types are JSON-ready: text ISO dates,
  int/float8 numbers, text enums. Any Postgres client therefore returns rows matching the app's
  `Row` type. Heavy aggregates are materialized; row-level reports are plain `security_invoker`
  views. `reports.report_definitions` stores one `ReportDef` JSON per report (without
  `rowCount`, which `refresh_all()` counts nightly). Its enum options come from the database
  enum types, and the migration fails if any field names a missing column, an unknown type or
  tag, or an enum without options. Amounts stay in the order's currency, and revenue
  aggregates convert to USD through a daily `exchange_rates` table.
- Consequences: Easier — the app can switch from `src/data/seed.ts` to Supabase without
  reshaping rows, and a config can never drift from its view unnoticed. Harder — the full seed
  is several GB and takes a long single transaction; plain report views sort and filter on
  computed text columns, so large pages need server-side pagination; new report icons and
  i18n keys must be added in the app before those reports render.

### ADR-006: Lookup tables and normalized report metadata mirroring the app

- Date: 2026-11-23
- Status: Accepted (supersedes ADR-005)
- Role: backend/data
- Context: The app (`src/data/reports.ts`) settled on six reports (orders, customers, invoices,
  shipments, tickets, products) with their own value sets and badge tones. The owner asked for
  the report metadata as normalized tables in the reports schema. The app team asked for coded
  values as real lookup tables with en/he labels and tones, and for no stored row counts.
- Decision: Coded values live in 20 lookup tables in `public` (`code`, `label_en`, `label_he`,
  `tone`, `sort_order`, `active`). Fact tables reference them by foreign key instead of using
  Postgres enums. Business rules that are data stay in the lookups (`ticket_priorities.sla_hours`).
  Report metadata lives in `reports.reports` and `reports.report_fields`, with labels copied from
  the app's en/he messages and each enum/status field naming its lookup table. Each report has one
  view, `reports.<id>`, whose columns are exactly its field keys. The migration fails if metadata
  and views disagree, and the seed ends with `reports.check_lookup_values()`. The default seed scale
  stays at millions of rows; `-v scale=0.0005` gives the ~2,000-order demo. Server code connects
  with `POSTGRES_URL`, the pooled URL the Vercel Marketplace integration sets; migrations use
  `POSTGRES_URL_NON_POOLING`.
- Consequences: Easier — labels, tones and codes change with an `update`, no deploy; a field can
  never point at a missing column or code without a failing migration or seed. Harder — the DB and
  `src/data/reports.ts` hold the same metadata until the app reads it from the DB, so they can
  drift; adding a report means a view plus metadata rows. Auth, roles and per-role report
  permissions are not in this slice.
