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
