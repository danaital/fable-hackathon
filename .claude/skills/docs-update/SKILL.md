---
name: docs-update
description: Use after a merge, after a slice lands, or when docs may be stale. Updates README.md, CLAUDE.md, docs/DECISIONS.md, and docs/CHANGELOG.md to match the repo.
---

# Team docs update

Make the docs match the code as it is, not as it was planned.

You may edit README.md, CLAUDE.md, docs/DECISIONS.md, and docs/CHANGELOG.md.
You may not change program logic or tests.

Do:

- Fix stale run commands and missing env names, without writing secret values
- Append a CHANGELOG line for this slice, with date and role
- Append a DECISIONS entry only when an architecture choice changed
- Keep team workflow and agent rules in CLAUDE.md, not in random chat notes

If something is unknown, say so. Definition of done: a teammate can run the app from the README alone.
