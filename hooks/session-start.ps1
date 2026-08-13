# session-start hook (PowerShell) — runs with no external runtime requirements.
# Used on native Windows (not WSL). CLAUDE_PLUGIN_ROOT is a valid Windows path here.

$ErrorActionPreference = 'SilentlyContinue'

$pluginRoot = $env:CLAUDE_PLUGIN_ROOT
if ($pluginRoot -and (Get-Command node -ErrorAction SilentlyContinue)) {
    $hookScript = Join-Path $pluginRoot 'dist\hooks\session-start.js'
    if (Test-Path $hookScript) {
        & node $hookScript 2>$null
    }
}

exit 0
