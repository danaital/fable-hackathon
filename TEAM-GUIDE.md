# Fable 5.2 hackathon — English team guide

A practical setup for a team of up to 4 people, each running Claude Code and the project subagents on their own laptop, against one shared GitHub repo. Copy the files in this folder into the repo (or start the repo from this folder).

Let Claude Code do the installations. After the pack is on `main` and you have cloned it, open Claude Code in the repo folder and paste:

```text
Read CLAUDE-SETUP-PROMPT.md and execute it.
```

That file is addressed to Claude Code. It checks prerequisites, installs official plugins, writes or verifies `.mcp.json`, and prints a short list of steps only a human can do (folder trust, `/mcp` OAuth, logins, and local API keys). Do not run a long install checklist yourself unless Claude reports a command it could not run.

Hackathon rule: the category is revealed at the event, then you have 75 minutes to build. Do not arrive with a finished product. Arrive with a working environment, shared repo, and a practiced loop.

Verified sources used throughout:

- https://code.claude.com/docs/en/plugins/install
- https://code.claude.com/docs/en/settings
- https://code.claude.com/docs/en/hooks-guide
- https://code.claude.com/docs/en/skills
- https://github.com/anthropics/claude-plugins-official
- https://github.com/Graphify-Labs/graphify
- https://obsidian.md/help/skills
- https://ui.shadcn.com/docs/skills
- https://code.claude.com/docs/en/mcp
- https://vercel.com/docs/agent-resources/vercel-mcp
- https://supabase.com/docs/guides/ai-tools/mcp
- https://context7.com/docs/clients/claude-code

Community plugins are labeled as community. They are not official Anthropic releases. Review the repo before you install one.

## 1. What each person needs before the event

- Claude Code 2.1.321 or newer, logged in. Fable 5.2 notes: https://support.claude.com/en/articles/15424964-claude-fable-models-on-your-plan
- Git, Node.js LTS, and a GitHub account
- A Vercel account, and a Supabase account if you need a backend
- This file pack copied into the shared repo on `main`

Event API credits stay in each person's Console or Claude login. Never commit API keys.

## 2. Shared repo layout

Commit these paths from this pack:

- `CLAUDE-SETUP-PROMPT.md` — instructions for Claude Code to set up the machine and repo
- `CLAUDE.md` — project rules, agent loop, and human-team rules
- `.mcp.json` — team-shared MCP servers (public URLs and the Playwright stdio command; no secrets)
- `.claude/settings.json` — shared permissions, Prettier hook, enabled plugins
- `.claude/settings.local.json` — do not commit (personal overrides; already gitignored)
- `.claude/hooks/format-prettier.sh` — formats a file after Claude edits it (needs `jq`)
- `.claude/agents/` — planner, implementer, tester, reviewer, debugger, docs-keeper
- `.claude/skills/` — hackathon-demo-ready, pr-handoff, code-review-checklist, docs-update
- `.gitignore`, `.env.example`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`

Personal skills stay in `~/.claude/skills` on one machine. Team process belongs in `.claude/skills` in the repo.

Installing a plugin at project scope writes `enabledPlugins` into `.claude/settings.json`. That turns the plugin on for collaborators, but does not download it to their machines. Each person still runs `claude plugin install name@marketplace --scope project` once after cloning. Docs: https://code.claude.com/docs/en/plugins/install

Allow rules in `.claude/settings.json` take effect only after each person trusts the project folder.

## 3. Human roles and git in 75 minutes

Suggested split:

| Role | Owns | Typical plugins |
| --- | --- | --- |
| Frontend | UI, components, visual demo path | frontend-design, shadcn skill, Figma if needed, Playwright |
| Backend / data | API, database, auth | supabase, context7 |
| AI / prompts | Model calls, prompts, library docs | context7, skill-creator, optional Graphify |
| Demo / pitch | Deploy, README, 2-minute script, merge captain | vercel, github, commit-commands, /hackathon-demo-ready |

Rules:

- `main` must stay demoable.
- Short branches only: `feat/frontend`, `feat/api`, `feat/ai`, `feat/demo`, or `feat/<name>`. No Git Flow.
- Do not edit the same file in parallel. Agree on directories in the first plan.
- One merge captain. No force-push to `main`.
- If a conflict will burn the demo, keep what already runs on `main`.

### 75-minute timeline

| Time | What you do | Exit criteria |
| --- | --- | --- |
| 0–5 | Pick the idea and confirm roles | One sentence for the demo |
| 5–15 | Shared `/plan`; write interfaces in `docs/DECISIONS.md`; open branches | A plan everyone can see on git |
| 15–35 | First slice | Merge to `main`; the app runs |
| 35–50 | Second slice | Second merge to `main` |
| 50–60 | Integrate, tests, Playwright | Demo path works locally |
| 60–70 | Deploy and `/hackathon-demo-ready` | Live URL or a stable local screen |
| 70–75 | Freeze `main`; rehearse the 2-minute pitch | A script spoken out loud |

## 4. Official plugins

Anthropic's official marketplace name is `claude-plugins-official`. It is added automatically on the first interactive Claude Code session. If it is missing:

```text
/plugin marketplace add anthropics/claude-plugins-official
```

### On every laptop (project scope)

```bash
claude plugin install frontend-design@claude-plugins-official --scope project
claude plugin install code-review@claude-plugins-official --scope project
claude plugin install commit-commands@claude-plugins-official --scope project
claude plugin install vercel@claude-plugins-official --scope project
claude plugin install github@claude-plugins-official --scope project
claude plugin install context7@claude-plugins-official --scope project
claude plugin install playwright@claude-plugins-official --scope project
claude plugin install skill-creator@claude-plugins-official --scope project
```

Or the same commands inside a session as `/plugin install <name>@claude-plugins-official`, then choose project scope.

Prefer the official GitHub plugin over putting a personal access token in `.mcp.json`. If a plugin already starts an MCP server, do not add the same server again with `claude mcp add`.

### Role-specific (install only if that role needs it)

```text
/plugin install figma@claude-plugins-official
/plugin install supabase@claude-plugins-official
/plugin install sentry@claude-plugins-official
/plugin install typescript-lsp@claude-plugins-official
/plugin install code-simplifier@claude-plugins-official
/plugin install security-guidance@claude-plugins-official
```

`security-guidance` runs hooks on edits, so it has a context cost.

Document skills (Word, Excel, PowerPoint, PDF), if the demo needs a file:

```text
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
```

The marketplace name after `@` is `anthropic-agent-skills`, from the official catalog at https://github.com/anthropics/skills.

`feature-dev` is official, but in 75 minutes prefer `/plan` and the six project subagents in this pack.

Notion, Linear, Exa, and Firecrawl are also in the official marketplace. Install them only if the team already uses those tools.

## 5. Community plugins (optional, team must agree)

These are not official Anthropic plugins. Read the repository before installing. Security notes: https://code.claude.com/docs/en/plugins/security

**Caveman** — shorter answers; code, commands, and errors stay verbatim. Use `/caveman` to turn on, `stop caveman` to turn off. Turn it off when writing the 2-minute pitch.

```text
/plugin marketplace add JuliusBrussee/caveman
/plugin install caveman@caveman
```

Source: https://github.com/JuliusBrussee/caveman

**Ponytail** — lazy senior-dev mode: the smallest solution that works, without cutting validation, security, or accessibility. Use `/ponytail`. Helpful in a 75-minute build.

```text
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Source: https://github.com/DietrichGebert/ponytail

**Karpathy-inspired guidelines** — a community project, not an official release by Andrej Karpathy or Anthropic. Four principles: think before coding, simplicity first, surgical changes, goal-driven execution. For a team, the same principles are already in this pack's `CLAUDE.md`. If you still want the plugin:

```text
/plugin marketplace add forrestchang/andrej-karpathy-skills
/plugin install andrej-karpathy-skills@karpathy-skills
```

The current repository is https://github.com/multica-ai/andrej-karpathy-skills (`forrestchang/...` redirects there). If adding the marketplace fails, try `/plugin marketplace add multica-ai/andrej-karpathy-skills`.

**Superpowers** — community plugin by obra, listed in the official marketplace. Brainstorming, planning, TDD, and subagents. Optional; it can slow a 75-minute loop if you already use `/plan` and this pack's agents.

```text
/plugin install superpowers@claude-plugins-official
```

Source: https://github.com/obra/superpowers

Browse more, but do not install blindly: https://github.com/hesreallyhim/awesome-claude-code

## 6. UI design

- Official frontend skill: `/plugin install frontend-design@claude-plugins-official` — https://claude.com/marketplace/plugins/frontend-design
- Official shadcn skill: `npx skills add shadcn/ui` — https://ui.shadcn.com/docs/skills
- Optional shadcn MCP: `npx shadcn@latest mcp init --client claude`, then restart Claude Code — https://ui.shadcn.com/docs/mcp
- Official Vercel agent skills (React performance, composition, accessibility, deploy): `npx skills add vercel-labs/agent-skills` — https://github.com/vercel-labs/agent-skills
- Figma, if you have a file: `/plugin install figma@claude-plugins-official`
- Check the screen with Playwright, not only by reading the code

Suggested flow: pick a visual direction with frontend-design, compose with shadcn instead of inventing every control, then verify in a browser.

## 7. Graphify and Obsidian

**Graphify** builds a local knowledge graph of the repo so the team can query structure instead of grepping everything. Official source (default branch is currently `v8`): https://github.com/Graphify-Labs/graphify. Docs: https://docs.graphify.com/open-source/quickstart

The official PyPI package is `graphifyy` (two y's). Other `graphify*` packages on PyPI are not affiliated. The CLI command is still `graphify`. Needs Python 3.11.5–3.14 and uv or pipx.

```bash
uv tool install graphifyy
# Alternative: pipx install graphifyy
graphify install
graphify install --project
```

`--project` writes the skill into the repo (usually `.claude/skills/graphify/SKILL.md`) so teammates get it. Commit the files it prints. Then, in Claude Code:

```text
/graphify .
```

That writes `graphify-out/graph.html`, `GRAPH_REPORT.md`, and `graph.json`. Later: `/graphify query` plus a question. Code is parsed locally with tree-sitter. A semantic pass over docs or images uses the assistant's model or a configured API key. Team workflow: https://docs.graphify.com/guides/team-workflows

Gitignore `graphify-out/cache/`. A remote MCP is optional and needs a Graphify Cloud account:

```bash
claude mcp add --transport http graphify https://api.graphify.com/mcp
```

For the hackathon, the local CLI is enough. Local MCP: `uv tool install "graphifyy[mcp]"`, then `graphify-mcp`.

**Obsidian:** official skills exist; there is still no official Obsidian MCP. Official repo: https://github.com/obsidianmd/obsidian-skills. Help: https://obsidian.md/help/skills. The old address `kepano/obsidian-skills` redirects there.

```bash
claude plugin marketplace add obsidianmd/obsidian-skills
claude plugin install obsidian@obsidian-skills
```

Team memory lives in this git repo (`docs/DECISIONS.md`, `docs/CHANGELOG.md`, `README.md`), not in one person's private vault. If you want a shared vault, make a separate git-backed vault everyone clones. The simplest local option is to run `claude` inside the vault folder, or point the official Filesystem MCP at that vault only. Community Obsidian MCP servers exist and are unofficial; skip them for the event unless you truly need tools from claude.ai without file access.

## 8. Shared skills in this pack

After cloning, these commands should work in Claude Code:

- `/hackathon-demo-ready` — pre-demo checklist
- `/pr-handoff` — branch or PR handoff to a teammate
- `/code-review-checklist` — pre-merge review (complements the reviewer subagent and the code-review plugin)
- `/docs-update` — keep README, CLAUDE.md, DECISIONS, and CHANGELOG in sync

Ask "What skills are available?" if a command is not recognized. Restart the session after adding new skill folders.

## 9. Hooks and secrets

The committed hook runs Prettier after `Edit` or `Write`. It needs `jq` (`brew install jq` on macOS) and works most reliably in bash or Git Bash. If the hook gets in the way, remove it from `.claude/settings.json` and run `npm run lint` yourself. Hook guide: https://code.claude.com/docs/en/hooks-guide

Shared settings deny reading `.env`, `.env.*`, and `secrets/**`. Copy `.env.example` to a local `.env`. Invite the whole team to one Vercel project and, if needed, one Supabase project. Do not create four separate deployments.

This pack commits `.mcp.json` with official public endpoints only: Vercel (`https://mcp.vercel.com`), Supabase (`https://mcp.supabase.com/mcp`), Context7 OAuth (`https://mcp.context7.com/mcp/oauth`), and Playwright as `npx -y @playwright/mcp@latest`. HTTP entries include `"type": "http"`. There are no `Authorization` headers in the file.

GitHub is not in `.mcp.json`. The official documented `claude mcp add` for GitHub uses a personal access token in a header, which must never be committed. Use the official `github@claude-plugins-official` plugin and authenticate with `/mcp`.

Official Vercel, Context7, Playwright, and Supabase plugins may also start MCP servers. Do not run `claude mcp add` for a name that already exists. If the same name is defined in more than one scope, keep the project `.mcp.json` entry and disable the duplicate in `/mcp`. Docs: https://code.claude.com/docs/en/mcp

## 10. How the agent team works

Flow: `/plan` + planner → implementer → tester → reviewer → debugger (if needed) → docs-keeper → done.

Each human runs that loop on their own slice, not on the same files. Plan together first. Hand off with `/pr-handoff`. Review before merge. Run `/hackathon-demo-ready` before you present.
