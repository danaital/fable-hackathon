# Instructions for Claude Code: set up this machine and repo

You are setting up this machine and this repository for the Fable 5.2 hackathon team. Do the work yourself. Do not ask the human to run install commands that you can run safely from the shell. The human should only do steps that require a browser, an account login, an OAuth consent screen, a password, or an API key.

Read this file completely, then execute the steps in order. Work from the project root (the folder that contains this file).

Official sources for every command below:

- Plugins: https://code.claude.com/docs/en/plugins/install and https://code.claude.com/docs/en/plugins/cli-reference
- MCP: https://code.claude.com/docs/en/mcp
- Skills: https://code.claude.com/docs/en/skills
- Hooks: https://code.claude.com/docs/en/hooks-guide
- Vercel MCP: https://vercel.com/docs/agent-resources/vercel-mcp
- Supabase MCP: https://supabase.com/docs/guides/ai-tools/mcp
- Playwright MCP: https://code.claude.com/docs/en/mcp-quickstart
- shadcn skills: https://ui.shadcn.com/docs/skills
- Vercel agent skills: https://github.com/vercel-labs/agent-skills
- Obsidian skills: https://obsidian.md/help/skills
- Graphify: https://github.com/Graphify-Labs/graphify (default branch `v8`) and https://docs.graphify.com/open-source/quickstart

Do not invent plugin names, marketplaces, MCP URLs, or CLI flags. If a command is not on that list, skip it and report it as unverified.

## Rules

- Be idempotent. If a marketplace, plugin, MCP server, skill, hook, or file is already present and correct, leave it and move on. Treat "already installed" as success.
- Ask before anything destructive: overwriting a customized `CLAUDE.md`, `.claude/settings.json`, `.mcp.json`, hook, or skill; removing a plugin or MCP server; uninstalling software; or deleting files the human wrote.
- Never commit secrets. Never write API keys, tokens, passwords, or `Authorization` header values into git, `.mcp.json`, `.claude/settings.json`, or any committed file. If a token is required, use an environment variable reference such as `${SOME_API_KEY}` in a local or user-scope config only, or tell the human to sign in with `/mcp`.
- Prefer `--scope project` for team plugins and MCP servers so the repo stays the source of truth.
- Official plugins may start their own MCP servers. This pack also commits official HTTP or stdio endpoints in `.mcp.json`. After installs, run `claude mcp list`. Do not run `claude mcp add` for a name that already exists. If Claude Code warns that the same name is defined in more than one scope, do not delete files. Report the conflict and ask the human to keep one definition: prefer the project `.mcp.json` entry for `vercel`, `supabase`, and `playwright`, and disable the duplicate in `/mcp` if needed.
- GitHub MCP is not in `.mcp.json`. The official documented `claude mcp add` for GitHub uses a personal access token in an `Authorization` header, which must never be committed. Install `github@claude-plugins-official` instead, and let the human authenticate with `/mcp`.
- Community plugins are optional and not official Anthropic releases. Ask before installing any of them.
- On Windows, prefer Git Bash for the Prettier hook. `claude plugin` and `claude mcp` can run in PowerShell or Git Bash.

## 1. Detect the OS and check prerequisites

Detect macOS, Windows, or Linux. Then check these tools and print their versions:

- `git`
- `node` and `npm` (Node.js LTS is expected)
- `jq` (required by `.claude/hooks/format-prettier.sh`)
- `uv` (only required if the team wants Graphify)
- `claude`

If a required tool is missing, install it if you can do so safely, after a short confirmation of the exact command you will run. If you cannot install it, print the exact command for the human and continue with whatever is possible.

Suggested, official or widely used install options (ask before running a curl-to-shell or package-manager install):

- macOS, if Homebrew is available: `brew install git node jq`, and for uv either `brew install uv` or the official installer at https://docs.astral.sh/uv/getting-started/installation/
- Linux: use the distro package manager for `git`, `nodejs`, `npm`, and `jq`. For uv, use the official installer docs above.
- Windows: install Git for Windows (includes Git Bash) from https://git-scm.com/download/win, Node.js LTS from https://nodejs.org, and jq from https://jqlang.github.io/jq/download/. If `winget` is available, you may offer `winget` packages for Git, Node.js, and jq, but confirm the package id before running it. For uv, use the official Windows installer in the uv docs.

## 2. Verify Claude Code

Run:

```bash
claude --version
```

This pack expects Claude Code 2.1.321 or newer (Fable 5.2 notes: https://support.claude.com/en/articles/15424964-claude-fable-models-on-your-plan). If `claude` is missing or older, tell the human how to install or update it. Do not invent an updater flag. Do not continue plugin or MCP installs until `claude` is on PATH.

If the workspace has not been trusted yet, tell the human to trust this folder in Claude Code so project allow rules, hooks, and `.mcp.json` approvals can take effect. You cannot complete the trust dialog for them.

## 3. Ensure pack files exist

This pack should already be in the repo. Create a missing file only when it is absent. If a file exists and differs from this pack, show the difference and ask before overwriting.

Required paths:

- `CLAUDE.md`
- `CLAUDE-SETUP-PROMPT.md` (this file)
- `TEAM-GUIDE.md`
- `.mcp.json`
- `.gitignore`
- `.env.example`
- `docs/DECISIONS.md`
- `docs/CHANGELOG.md`
- `.claude/settings.json`
- `.claude/hooks/format-prettier.sh` (executable; `chmod +x` on macOS and Linux)
- `.claude/agents/planner.md`, `implementer.md`, `tester.md`, `reviewer.md`, `debugger.md`, `docs-keeper.md`
- `.claude/skills/hackathon-demo-ready/SKILL.md`
- `.claude/skills/pr-handoff/SKILL.md`
- `.claude/skills/code-review-checklist/SKILL.md`
- `.claude/skills/docs-update/SKILL.md`

Do not write `.claude/settings.local.json` unless the human asks. It is personal and gitignored.

If `.env` is missing, copy `.env.example` to `.env` locally and leave the values empty. Never commit `.env`.

## 4. Add marketplaces and install official plugins

From the project root, run these in the shell, not as a guess inside the chat. Project-scope install is idempotent: already-installed plugins should report success.

```bash
claude plugin marketplace add anthropics/claude-plugins-official --scope project

claude plugin install frontend-design@claude-plugins-official --scope project
claude plugin install code-review@claude-plugins-official --scope project
claude plugin install commit-commands@claude-plugins-official --scope project
claude plugin install vercel@claude-plugins-official --scope project
claude plugin install github@claude-plugins-official --scope project
claude plugin install playwright@claude-plugins-official --scope project
claude plugin install skill-creator@claude-plugins-official --scope project
```

If the official marketplace was already added, continue. If a plugin install aborts because it needs a TTY confirmation (official docs: `-y` is ignored when Claude Code runs the command through its Bash tool), stop that plugin and add the exact command to the human paste block at the end. Do not invent a workaround.

Ask before installing any of these official, role-specific plugins:

```bash
claude plugin install figma@claude-plugins-official --scope project
claude plugin install supabase@claude-plugins-official --scope project
claude plugin install sentry@claude-plugins-official --scope project
claude plugin install typescript-lsp@claude-plugins-official --scope project
claude plugin install code-simplifier@claude-plugins-official --scope project
claude plugin install security-guidance@claude-plugins-official --scope project
```

`security-guidance` runs hooks on edits, so it has a context cost. `supabase@claude-plugins-official` may overlap with the committed Supabase MCP in `.mcp.json`; if you install it, do not also `claude mcp add` a second `supabase` server.

Document skills are official but optional. Ask first:

```bash
claude plugin marketplace add anthropics/skills --scope project
claude plugin install document-skills@anthropic-agent-skills --scope project
```

Skip `feature-dev` unless the human asks. In 75 minutes prefer `/plan` and the six project subagents in this pack.

## 5. Set up MCP servers

Ensure `.mcp.json` in the project root matches this pack (public URLs only, `type` set on every HTTP entry, no headers with secrets):

- `vercel` — HTTP, `https://mcp.vercel.com`
- `supabase` — HTTP, `https://mcp.supabase.com/mcp`
- `playwright` — stdio, `npx -y @playwright/mcp@latest`

If `.mcp.json` is missing or a verified server is missing, add only the missing server with one of these official commands:

```bash
claude mcp add --scope project --transport http vercel https://mcp.vercel.com
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp"
claude mcp add --scope project playwright -- npx -y @playwright/mcp@latest
```

Do not add GitHub with `claude mcp add`. Do not pass `--header "Authorization: ..."` into a project-scope command. 

Then run:

```bash
claude mcp list
```

Project servers from `.mcp.json` often show `Pending approval` until the human trusts the folder and approves them in an interactive `claude` session or with `/mcp`. You cannot finish that approval from a non-interactive command. Record it in the human-only list.

Optional Graphify Cloud MCP, only if the human asks and has a Graphify Cloud account:

```bash
claude mcp add --transport http graphify https://api.graphify.com/mcp
```

Do not add this to the committed `.mcp.json` unless the team agrees. The local Graphify CLI is enough for the hackathon.

## 6. Optional skills and tools (ask first)

If the human wants them, these official commands are verified:

```bash
npx skills add shadcn/ui
npx skills add vercel-labs/agent-skills
```

Official Obsidian skills (there is still no official Obsidian MCP):

```bash
claude plugin marketplace add obsidianmd/obsidian-skills --scope project
claude plugin install obsidian@obsidian-skills --scope project
```

Graphify local CLI (official PyPI package is `graphifyy`, two y's; the command is still `graphify`):

```bash
uv tool install graphifyy
graphify install
graphify install --project
```

Community plugins, only if the whole team agrees. Review the repo first:

```bash
claude plugin marketplace add JuliusBrussee/caveman --scope project
claude plugin install caveman@caveman --scope project

claude plugin marketplace add DietrichGebert/ponytail --scope project
claude plugin install ponytail@ponytail --scope project

claude plugin marketplace add forrestchang/andrej-karpathy-skills --scope project
claude plugin install andrej-karpathy-skills@karpathy-skills --scope project

claude plugin install superpowers@claude-plugins-official --scope project
```

If adding the Karpathy marketplace fails, try `claude plugin marketplace add multica-ai/andrej-karpathy-skills --scope project`. The current repository is https://github.com/multica-ai/andrej-karpathy-skills. This is a community project, not an official release by Andrej Karpathy or Anthropic.

If a `claude plugin` command is not available or a marketplace add fails in the shell, put the matching slash commands in one paste block for the human (see the end of this file). Do not invent a different plugin id.

## 7. Verification

Run and quote the output of:

```bash
claude --version
claude plugin marketplace list
claude plugin list
claude mcp list
```

There is no official `claude skills list` shell command. Verify project skills by listing `.claude/skills/*/SKILL.md` and project agents by listing `.claude/agents/*.md`. Tell the human to run `What skills are available?` or `/skills` in the next session if they want a live skill list. Restart or `/reload-plugins` may be needed before new plugins load.

Test the hook on macOS, Linux, or Git Bash (requires `jq` and `npx prettier`):

1. Confirm `.claude/hooks/format-prettier.sh` is executable.
2. Create a short temporary JavaScript file in the project, send a JSON payload with that `file_path` into the hook on stdin, and confirm the file was formatted or that the hook exited `0`.
3. Delete only the temporary file you created.

If `prettier` is not installed, `npx prettier` may download it. If the hook fails, report the error. Do not remove the hook without asking.

## 8. Finish with a report

Print a short report with:

- OS detected
- Prerequisite versions, and anything you could not install
- Claude Code version
- Pack files created, already present, or left unchanged
- Plugins installed, already present, or failed
- MCP servers in `.mcp.json` and the status from `claude mcp list`
- Optional items skipped because you asked first
- Any name conflicts between a plugin MCP and `.mcp.json`

Then print the short list of steps only a human can do, and, if anything failed in the shell, one paste block they can run in their own terminal or inside a Claude Code session.

### Steps only a human can do

1. Trust this project folder in Claude Code, if you have not already, so allow rules, hooks, and project MCP approvals apply.
2. In an interactive session, run `/mcp`. Approve the project servers from `.mcp.json`. Sign in with OAuth to Vercel, Supabase, and the official GitHub plugin. Playwright does not need an account.
3. Log in to Claude or Console with your own credits. Event API credits stay in that login, never in git.
4. Copy `.env.example` to `.env` if needed and add any local app secrets yourself. Do not commit `.env`, API keys, or tokens.
5. Accept any Vercel or Supabase team invites, and use one shared Vercel project and, if needed, one shared Supabase project.
6. If a plugin install aborted inside this session, paste the fallback block below in your own terminal, not inside Claude's Bash tool.

### Fallback paste block (only if a CLI step failed)

Shell, from the project root:

```bash
claude plugin marketplace add anthropics/claude-plugins-official --scope project
claude plugin install frontend-design@claude-plugins-official --scope project
claude plugin install code-review@claude-plugins-official --scope project
claude plugin install commit-commands@claude-plugins-official --scope project
claude plugin install vercel@claude-plugins-official --scope project
claude plugin install github@claude-plugins-official --scope project
claude plugin install playwright@claude-plugins-official --scope project
claude plugin install skill-creator@claude-plugins-official --scope project
```

Same work as slash commands, if you prefer to paste inside a Claude Code session (choose project scope when asked):

```text
/plugin marketplace add anthropics/claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install code-review@claude-plugins-official
/plugin install commit-commands@claude-plugins-official
/plugin install vercel@claude-plugins-official
/plugin install github@claude-plugins-official
/plugin install playwright@claude-plugins-official
/plugin install skill-creator@claude-plugins-official
/mcp
```
