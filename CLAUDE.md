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
