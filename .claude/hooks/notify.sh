#!/usr/bin/env bash
# Desktop alert when Claude waits for input. No-op where no notifier exists.
msg=$(jq -r '.message // "Claude is waiting for you"' 2>/dev/null || echo "Claude is waiting for you")
if command -v osascript >/dev/null; then osascript -e "display notification \"${msg//\"/}\" with title \"Claude Code\""
elif command -v notify-send >/dev/null; then notify-send "Claude Code" "$msg"
fi
exit 0
