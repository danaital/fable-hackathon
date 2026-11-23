# Project rules

## Commands

- Install: npm install
- Dev: npm run dev
- Test: npm test
- Build: npm run build
- Deploy preview: `vercel` (production: `vercel --prod`, merge captain only). Env vars live in Vercel (`vercel env pull .env` to sync locally), never in git.

## Team workflow

1. Start in /plan. Do not write feature code until the plan is accepted.
2. Work in small slices. One slice at a time.
3. Before coding against a library API, check the official docs for the installed version (web search or fetch the library's docs site, and check node_modules types). Never invent an API.
4. After implementation, run tests and the app. If there is a UI, verify with Playwright or a real browser.
5. Then ask the reviewer subagent to review. Only report issues with confidence 80+.
6. If review or tests find a bug, the debugger fixes it and the tester re-runs.
7. The docs-keeper checks README.md, CLAUDE.md, docs/DECISIONS.md, and docs/CHANGELOG.md before anyone claims done.
8. Never claim done without a command that was actually run and its output.

## Code rules (every agent)

Smallest complete change (Ponytail):
- Before writing, list every place the change must reach: callers, tests, config, exports. That is scope; extra features are not.
- Prefer, in order: not building it, reusing code already in the repo, the platform or standard library, an installed dependency, then the minimum new code.
- No speculative abstractions, options, wrappers or "for later" code. Deletion beats addition. Keep the repo's existing structure.
- Never cut: input validation at trust boundaries, error handling that prevents data loss, security, accessibility.
- A shortcut with a known limit gets a one-line comment: `shortcut: <limit>, <when to upgrade>`.

Code quality:
- TypeScript strict. No `any`, no `@ts-ignore`, no `eslint-disable`, no loosening lint config. Fix the root cause.
- Functions with 3 or more parameters take one object.
- No magic strings or numbers: named constants or enums. Prefer a `Record` lookup to a long `switch` or nested ternaries.
- No `console.*` left in committed code paths; use one small logger.
- No new dependency without a one-line reason in the handoff.
- Reuse shared UI components instead of copying markup. Keep components small; split files that pass ~300 lines instead of growing them.
- Don't create a new file when an existing one can host the change.

Security by default:
- Validate every request body and query (zod or equivalent) on the server.
- Secrets only in env vars, read on the server. Never in client components, logs, or git. Missing env vars fail fast with a clear error.
- No hardcoded API hosts; base URLs come from env.
- Parameterized queries only. Auth check on every non-public route, Supabase RLS on every table.
- No PII or tokens in logs.

Per-step QA (after each step of a plan, stop on the first failure):
1. Diff touches only that step's files.
2. Type-check and lint show no new errors.
3. Tests pass; a fixed bug gets a regression test that failed before the fix.
4. UI renders with no console errors.
5. Report the result as pass, fail or deferred.

## Docs rules (every agent)

After your change, update the matching docs in the same turn:

- User-facing behavior: README.md
- Commands, conventions, agent workflow: CLAUDE.md
- Architecture or trade-off: append an ADR to docs/DECISIONS.md (use its template)
- What changed: add a line under Unreleased in docs/CHANGELOG.md (Keep a Changelog sections)
- Commits: Conventional Commits, e.g. `feat(api): add search route`, `fix(ui): empty state`, `docs: update README`

Research and decks: use /deep-research, /competitive-brief, /synthesize-research, /product-brainstorming, /write-spec, /user-research, /research-synthesis, and /pptx for the pitch deck.

Do not invent APIs. If unsure, say so and point to the command you ran.

## Handoff format

## Handoff

- Status:
- What changed (paths):
- How verified (commands and results):
- Docs updated (paths):
- Open risks:
- Next agent:

## Human team (max 4)

- One shared repo. main must stay demoable.
- Humans: frontend, backend/data, AI/prompts, demo/pitch. Edit only your slice and directories.
- Start together in /plan. Write the agreed interfaces in docs/DECISIONS.md.
- Each person runs the project subagents on their own slice. Use /pr-handoff before asking someone to continue.
- Merge to main around minute 35 and 50 after tests or a browser check. One merge captain.
- Before claiming the demo ready, run /hackathon-demo-ready.
- Think before coding. Prefer the smallest change. Do not touch unrelated files. Define a check you can run.
- Never commit .env, API keys, or tokens. Each person uses their own Claude login or Console credits.
