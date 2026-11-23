---
name: code-review-checklist
description: Use before merging to main, when the user asks for a review, or after tests pass. A short checklist for bugs, secrets, demo breakage, and CLAUDE.md violations.
---

# Pre-merge review checklist

Review the current diff against main, or the files the user names. Read only unless the user asks for fixes.

Check, in order:

1. The agreed slice only. No unplanned rewrite.
2. The happy path of the demo still works, or say what you could not run.
3. No secrets, API keys, or .env values in the diff.
4. Errors and empty states are handled on any new user-facing flow.
5. Tests or a browser check were run; quote the command and result.
6. README, docs/CHANGELOG.md, or docs/DECISIONS.md updated if behavior changed.

Only report issues with confidence 80+. Give file, line, why, and a concrete fix. If clean, say so and name docs-keeper or merge as next.
