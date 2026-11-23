# Fable 5.2 Hackathon — Team Pack

A ready-to-build Claude Code environment for a team of up to 4 people building one
app against one shared repo in a 75-minute hackathon.

**This repo is the environment, not the product.** You arrive with a working Claude
Code setup, a shared repo, an agent team, and a practiced loop. The category is
revealed at the event; the app is built then. The full event timeline is in
[TEAM-GUIDE.md](TEAM-GUIDE.md).

## What's in the box

- **Agent team** — seven project subagents in [`.claude/agents/`](.claude/agents) that run a
  plan → build → test → review → debug → docs loop.
- **Rules** — [CLAUDE.md](CLAUDE.md): the code, UI, security, and docs rules every agent
  (human or AI) follows, built on the Ponytail *smallest complete change* discipline.
- **Skills** — `/plan`, `/hackathon-demo-ready`, `/pr-handoff`, `/code-review-checklist`,
  `/docs-update`, `/caveman`, plus research and pitch-deck skills. Agents preload Ponytail,
  caveman, and Obsidian skills (map in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).
- **MCP servers** — Vercel, Supabase, and Playwright wired in [`.mcp.json`](.mcp.json)
  (public URLs only, no secrets).
- **Hooks** — Prettier-on-save ([`.claude/hooks/format-prettier.sh`](.claude/hooks/format-prettier.sh))
  and a desktop alert when Claude waits ([`.claude/hooks/notify.sh`](.claude/hooks/notify.sh)).
- **Docs** — this README, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
  [docs/DECISIONS.md](docs/DECISIONS.md), [docs/CHANGELOG.md](docs/CHANGELOG.md), and the API
  contract [`docs/openapi.json`](docs/openapi.json). The repo opens as an Obsidian vault.
- **Health check** — [`scripts/health-check.mjs`](scripts/health-check.mjs) checks Vercel,
  Supabase, the docs vault, and the API contract in one command.

## Quickstart

1. Clone the repo and open it in Claude Code.
2. **Trust the folder** when prompted, so allow-rules, hooks, and project MCP servers take effect.
3. In the session, paste: `Read CLAUDE-SETUP-PROMPT.md and execute it.` Claude installs the
   project plugins and verifies the pack.
4. Run `/mcp` and sign in (OAuth) to **Vercel**, **Supabase**, and the **GitHub** plugin.
   Playwright needs no account. *These steps are human-only — Claude cannot complete an OAuth screen.*
5. Copy `.env.example` to `.env` and add your own local secrets, or run `vercel env pull .env`.
   Never commit `.env`.
6. Run `node scripts/health-check.mjs`. Every line should say `PASS` before the event starts.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Dev | `npm run dev` |
| Test | `npm test` |
| Build | `npm run build` |
| Deploy preview | `vercel` (production `vercel --prod`, merge captain only) |
| Health check | `node scripts/health-check.mjs` (exits 1 on any failure) |

Env vars live in Vercel (`vercel env pull .env` to sync locally), never in git.

> [!NOTE]
> Application code (`package.json`, `src/`) is scaffolded at the event, once the category is
> known — not committed ahead of time. Then add `"health": "node scripts/health-check.mjs"`
> to `package.json` scripts so `npm run health` works.

## The team

The loop: **planner → implementer → tester → reviewer (+ security-reviewer) → debugger → docs-keeper.**

### Agent roles ([`.claude/agents/`](.claude/agents))

| Agent | Does | Ponytail rule |
| --- | --- | --- |
| **planner** | Turns a goal into the smallest demoable slice and names files, interfaces, i18n keys, env vars, and one check per step. | Don't build what the demo doesn't need. |
| **implementer** | Builds one accepted slice; checks the installed library's docs, writes the failing test first, runs type-check/lint/test/build. | Reuse before you add; minimum code that works. |
| **tester** | Proves the slice with commands and Playwright, in English (LTR) and Hebrew (RTL). | One runnable check beats a claim. |
| **reviewer** | Read-only review of the diff for correctness, security, and CLAUDE.md; reports only issues at confidence 80+. | Flag scope creep and speculative code as defects. |
| **security-reviewer** | Read-only pass for auth, RLS, validation, secrets, injection, and untrusted input reaching models/HTML. | Never cut a check at a trust boundary to save code. |
| **debugger** | Reproduces, fixes the smallest root cause, adds a regression test. | Fix the cause once in shared code; no drive-by refactors. |
| **docs-keeper** | Makes README, CLAUDE.md, DECISIONS, and CHANGELOG match the code. | Say "unknown" instead of inventing. |

### Human roles (max 4)

| Role | Owns | Typical tools |
| --- | --- | --- |
| **Frontend** | UI, components, the visual demo path | frontend-design, Vercel agent skills, Playwright |
| **Backend / data** | API, database, auth | Supabase |
| **AI / prompts** | Model calls, prompts, library docs | skill-creator, optional Graphify |
| **Demo / pitch** | Deploy, README, 2-minute script; merge captain | Vercel, GitHub, commit-commands, `/hackathon-demo-ready` |

Full mandates, boundaries, and per-role Ponytail advice are in
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## System architecture

Two layers:

1. **Environment** — Claude Code + project plugins + MCP servers (Vercel, Supabase,
   Playwright) + the Prettier hook + the agent team, all defined in this repo so every
   laptop is identical.
2. **Target app** — Next.js (App Router) on Vercel, Supabase (Postgres + Auth + RLS) for
   data, styled-components with a shared theme, and first-class Hebrew/English i18n with RTL.

The full picture, data flow, trust boundaries, and the agent pipeline are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Integrations (MCP)

| Server | Transport | Auth |
| --- | --- | --- |
| Vercel | HTTP `https://mcp.vercel.com` | Human `/mcp` OAuth |
| Supabase | HTTP `https://mcp.supabase.com/mcp` | Human `/mcp` OAuth |
| Playwright | stdio `npx -y @playwright/mcp@latest` | None |
| GitHub | `github@claude-plugins-official` plugin | Human `/mcp` OAuth |
| Obsidian | `obsidian@obsidian-skills` plugin (skills only; no MCP); this repo is the vault | None |

No `Authorization` headers or tokens are committed. OAuth sign-in happens per laptop via `/mcp`.

## Docs in Obsidian

1. In Obsidian, choose **Open folder as vault** and pick this repo's folder. Obsidian's
   per-laptop state (`.obsidian/`) is gitignored.
2. The notes are this README, `CLAUDE.md`, `TEAM-GUIDE.md`, `CLAUDE-SETUP-PROMPT.md`, and
   everything in `docs/`. Graph view shows how they link.
3. Obsidian hides dot-folders, so `.claude/agents/` and `.claude/skills/` aren't in the
   vault. Read those on GitHub or in your editor.
4. After `npm install` at the event, add `node_modules` under **Settings → Files and links →
   Excluded files** so package READMEs don't clutter search and graph.
5. Optional: to let Claude use the `obsidian` CLI (the `obsidian:obsidian-cli` skill), turn it
   on in **Settings → General → Advanced**.

The format (standard links, GitHub-compatible callouts, `tags` on `docs/` notes) is defined
in the CLAUDE.md Docs rules, and `node scripts/health-check.mjs` checks it.

## API contract (Swagger / OpenAPI)

[`docs/openapi.json`](docs/openapi.json) is the API contract (OpenAPI 3.1). The planner adds
each route there before it is built, the implementer builds to it, the tester calls it, the
reviewer flags drift, and the docs-keeper keeps it in sync. It is empty until the app exists.
Once the app is scaffolded, serving it with Swagger UI is the first API slice. Until then,
open it in any OpenAPI viewer, such as Swagger Editor.

## Database (fake data + reports)

Supabase Postgres, provisioned through the Vercel Marketplace (`hackathon-db`, region `iad1`),
so its env vars are set on the Vercel project and `vercel env pull .env` brings them local:
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser), `POSTGRES_URL`
(pooled, for server code) and `POSTGRES_URL_NON_POOLING` (direct, for migrations and the seed).
SQL lives in [`supabase/`](supabase):

| File | What |
| --- | --- |
| [`migrations/0001_primary.sql`](supabase/migrations/0001_primary.sql) | 20 lookup tables, one per coded value set (currencies, countries, sales channels, order statuses, customer segments, invoice statuses, payment methods, carriers, shipment statuses, ticket channels, priorities and statuses, product categories, stock statuses, and more). Each has `code`, `label_en`, `label_he`, `tone`, `sort_order`, `active`. 18 entity and fact tables (customers, products, orders, order items, invoices, payments, shipments, returns, inventory, tickets, web sessions, …) reference them by foreign key. RLS is on for every table. |
| [`migrations/0002_reports.sql`](supabase/migrations/0002_reports.sql) | `reports` schema: one view per app report (`reports.orders`, `customers`, `invoices`, `shipments`, `tickets`, `products`). Column names are the field keys in [`src/data/reports.ts`](src/data/reports.ts); values are lookup codes, ISO date strings, numbers and booleans. |
| [`migrations/0003_report_metadata.sql`](supabase/migrations/0003_report_metadata.sql) | `reports.reports` and `reports.report_fields`: the six reports and their fields with en/he labels, type, position, lookup table and currency key. The migration fails if metadata and views disagree. Also `reports.refresh_all()`, `reports.check_lookup_values()` and a nightly pg_cron refresh at 02:15 UTC. No row counts are stored. |
| [`seed.sql`](supabase/seed.sql) | Synthetic data. `scale=1` (default): 1M customers, 4M orders, ~12M order lines, 10M web sessions. `scale=0.0005`: ~2,000 orders. |

Apply to an empty database. Each file runs in one transaction and stops on the first error;
drop `-v scale=0.0005` for the full dataset:

```bash
set -a; source .env; set +a
for f in supabase/migrations/0001_primary.sql supabase/migrations/0002_reports.sql supabase/migrations/0003_report_metadata.sql; do psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 --single-transaction -f "$f" || break; done
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 --single-transaction -v scale=0.0005 -f supabase/seed.sql
```

- The seed refuses to run when data is already present; its error prints the `truncate` to reseed.
  It ends with `reports.check_lookup_values()`, which fails if any report value is missing from its lookup.
- RLS is on with no policies: the browser (publishable key) reads no rows until a slice adds policies.
- `reports` has no grants to `anon` or `authenticated` and is not exposed through the Supabase
  REST API. Read it from server code over `POSTGRES_URL`: the catalogue from `reports.reports`
  and `reports.report_fields`, labels from each field's `lookup_table`, rows from `reports.<id>`.
  Refresh the materialized reports on demand with `select reports.refresh_all();`.

## Secrets & safety

- Secrets live only in env vars, read on the server. Never in client code, logs, or git.
- `.env`, `.env.*`, and `.vercel/` are gitignored; `.env.example` (empty values) is committed.
- Every non-public route checks auth; every Supabase table has RLS; every request body is validated.

## Repo map

| Path | What |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Project rules, agent loop, human-team rules |
| [CLAUDE-SETUP-PROMPT.md](CLAUDE-SETUP-PROMPT.md) | One-shot machine/repo setup, run by Claude Code |
| [TEAM-GUIDE.md](TEAM-GUIDE.md) | Human team guide and 75-minute timeline |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture + full roles & rules |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture Decision Records |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | What changed, per slice |
| [`docs/openapi.json`](docs/openapi.json) | API contract (OpenAPI 3.1) |
| [`scripts/health-check.mjs`](scripts/health-check.mjs) | Environment, docs, and API contract health check |
| [`supabase/`](supabase) | Database migrations (primary + reports schemas) and the fake-data seed |
| [`.claude/agents/`](.claude/agents) | The seven subagent definitions |
| [`.mcp.json`](.mcp.json) | Shared MCP servers |
