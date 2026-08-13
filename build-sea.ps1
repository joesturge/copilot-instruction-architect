# build-sea.ps1 — Build a standalone instruction-architect.exe using Node.js SEA.
#
# The resulting binary runs without requiring Node.js to be installed.
# Requires Node.js >= 20 to *build* (not to run).

param([string]$Output = "instruction-architect.exe")

$ErrorActionPreference = 'Stop'

if (-not (Test-Path "dist\index.js")) {
    Write-Error "dist\index.js not found — run 'npm run build' first."
    exit 1
}

Write-Host "Generating SEA blob..."
& node --experimental-sea-config sea-config.json

Write-Host "Copying node binary to $Output..."
$nodePath = (Get-Command node).Source
Copy-Item $nodePath $Output -Force

Write-Host "Injecting SEA blob..."
& npx --yes postject $Output NODE_SEA_BLOB sea-prep.blob `
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 2>$null

Write-Host "Done. Binary: .\$Output"
Write-Host "Test: .\$Output baseline"
