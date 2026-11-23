#!/usr/bin/env bash
# Formats the file Claude just wrote or edited. Requires jq and Prettier.
# Official hook pattern: https://code.claude.com/docs/en/hooks-guide
set -euo pipefail
f=$(jq -r '.tool_input.file_path // empty')
if [ -z "$f" ] || [ ! -e "$f" ]; then
  exit 0
fi
npx prettier --write --ignore-unknown "$f"
