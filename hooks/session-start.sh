#!/bin/sh
# session-start hook — runs with no external runtime requirements.
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

# Lightweight session start — no expensive analysis here.
# When Node.js is available and the compiled hook exists, delegate to it
# for richer session-tracking behaviour.
if command -v node >/dev/null 2>&1 && [ -n "$PLUGIN_ROOT" ] && [ -f "$PLUGIN_ROOT/dist/hooks/session-start.js" ]; then
    node "$PLUGIN_ROOT/dist/hooks/session-start.js" 2>/dev/null || true
fi

# Always exit successfully — a hook must never crash the session.
exit 0
