---
tags:
  - hackathon
  - changelog
---

# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Add one line per slice under Unreleased, in the right section, ending with `(role)`.

## [Unreleased]

### Added

- `README.md` front-door documentation (quickstart, roles, integrations, repo map) (docs-keeper)
- `docs/ARCHITECTURE.md`: environment + target-app architecture and full roles & rules with Ponytail advice (docs-keeper)
- `docs/DECISIONS.md`: ADR-001 fixed stack and seven-agent pipeline (docs-keeper)
- `scripts/health-check.mjs`: one-command check of Node, Vercel login/link/env, Supabase auth health, docs vault links and format, and the OpenAPI contract (chore)
- `docs/openapi.json`: contract-first API spec (OpenAPI 3.1), empty until the app exists; ADR-003 (planner)
- `caveman` project skill in `.claude/skills/caveman/` (chore)
- `docs/DECISIONS.md`: ADR-002 preloaded agent skills and repo-as-Obsidian-vault (docs-keeper)
- `supabase/`: primary schema with 20 en/he lookup tables (codes, labels, badge tones) and 18 entity/fact tables, RLS on every table; a `reports` schema with one view per app report and normalized metadata (`reports.reports`, `reports.report_fields`) mirroring `src/data/reports.ts`; nightly pg_cron refresh; scalable synthetic seed (4M orders at `scale=1`, ~2,000 at `scale=0.0005`); ADR-004 to ADR-006 (backend/data)
- `docs/bahir/`: Bahir product docs (hub, scope, brand, app architecture, data, build log) (docs-keeper)
- `docs/bahir/features/`: one behaviour note per feature, 20 notes, written from the original system's behaviour (docs-keeper)
- `docs/bahir/pitch.md`: two-minute pitch script with timings and demo cues (demo/pitch)

### Changed

- Enable the `ponytail` plugin in `.claude/settings.json` (chore)
- Agents preload skills: Ponytail (planner, implementer, debugger), ponytail-review and caveman (reviewer), caveman (tester, debugger), obsidian-markdown (docs-keeper); route agents follow `docs/openapi.json` (chore)
- Docs follow the Obsidian format in CLAUDE.md: `tags` properties on `docs/` notes, GitHub-compatible callouts, `.obsidian/` gitignored (docs-keeper)
- README and ARCHITECTURE now list `notify.sh` alongside the Prettier hook (docs-keeper)

### Fixed

### Removed
