# session-start hook (PowerShell) — runs with no external runtime requirements.
# Used on native Windows (not WSL). CLAUDE_PLUGIN_ROOT is a valid Windows path here.

$ErrorActionPreference = 'SilentlyContinue'

$pluginRoot = $env:CLAUDE_PLUGIN_ROOT
if ($pluginRoot -and (Get-Command node -ErrorAction SilentlyContinue)) {
    $tsxBin = Join-Path $pluginRoot 'node_modules\.bin\tsx'
    $hookScript = Join-Path $pluginRoot 'src\hooks\session-start.ts'
    if ((Test-Path $tsxBin) -and (Test-Path $hookScript)) {
        & node $tsxBin $hookScript 2>$null
    }
}

exit 0
