#!/bin/sh
# session-end hook — runs with no external runtime requirements.
#
# CLAUDE_PLUGIN_ROOT may contain Windows-style backslashes when Copilot Chat
# runs via WSL (see: https://github.com/obra/superpowers/issues/2091).
# Normalise to forward slashes before use.

set -e

# Normalise CLAUDE_PLUGIN_ROOT path separators for WSL compatibility.
if [ -n "${CLAUDE_PLUGIN_ROOT}" ]; then
    PLUGIN_ROOT=$(printf '%s' "${CLAUDE_PLUGIN_ROOT}" | sed 's|\\|/|g')
else
    PLUGIN_ROOT=""
fi

# At session end, run the lightweight reminder hook if available.
if command -v node >/dev/null 2>&1 && [ -n "$PLUGIN_ROOT" ] && [ -f "$PLUGIN_ROOT/node_modules/.bin/tsx" ]; then
    node "$PLUGIN_ROOT/node_modules/.bin/tsx" "$PLUGIN_ROOT/src/hooks/session-end.ts" 2>/dev/null || true
fi

# Always exit successfully — a hook must never crash the session.
exit 0
