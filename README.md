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
  `/docs-update`, plus research and pitch-deck skills.
- **MCP servers** — Vercel, Supabase, and Playwright wired in [`.mcp.json`](.mcp.json)
  (public URLs only, no secrets).
- **Hooks** — Prettier-on-save ([`.claude/hooks/format-prettier.sh`](.claude/hooks/format-prettier.sh)).
- **Docs** — this README, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
  [docs/DECISIONS.md](docs/DECISIONS.md), [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Quickstart

1. Clone the repo and open it in Claude Code.
2. **Trust the folder** when prompted, so allow-rules, hooks, and project MCP servers take effect.
3. In the session, paste: `Read CLAUDE-SETUP-PROMPT.md and execute it.` Claude installs the
   project plugins and verifies the pack.
4. Run `/mcp` and sign in (OAuth) to **Vercel**, **Supabase**, and the **GitHub** plugin.
   Playwright needs no account. *These steps are human-only — Claude cannot complete an OAuth screen.*
5. Copy `.env.example` to `.env` and add your own local secrets. Never commit `.env`.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Dev | `npm run dev` |
| Test | `npm test` |
| Build | `npm run build` |
| Deploy preview | `vercel` (production `vercel --prod`, merge captain only) |

Env vars live in Vercel (`vercel env pull .env` to sync locally), never in git.

> **Note:** application code (`package.json`, `src/`) is scaffolded at the event, once the
> category is known — not committed ahead of time.

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
| Obsidian | `obsidian@obsidian-skills` plugin (skills only; no MCP) | None |

No `Authorization` headers or tokens are committed. OAuth sign-in happens per laptop via `/mcp`.

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
| [`.claude/agents/`](.claude/agents) | The seven subagent definitions |
| [`.mcp.json`](.mcp.json) | Shared MCP servers |
