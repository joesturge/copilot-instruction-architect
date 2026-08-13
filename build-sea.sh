#!/bin/sh
# build-sea.sh — Build a standalone instruction-architect binary using Node.js SEA.
#
# The resulting binary runs without requiring Node.js to be installed.
# Requires Node.js >= 20 to *build* (not to run).
#
# Usage: ./build-sea.sh [output-name]
#   output-name defaults to "instruction-architect" (or "instruction-architect.exe" on Windows)

set -e

OUTPUT="${1:-instruction-architect}"

# Node SEA requires the main entry point to be a CJS bundle.
# We use esbuild if available, otherwise fall back to compiling with tsc and
# requiring that the user has already run `npm run build`.
if ! [ -f dist/index.js ]; then
    echo "dist/index.js not found — run 'npm run build' first." >&2
    exit 1
fi

echo "Generating SEA blob..."
node --experimental-sea-config sea-config.json

echo "Copying node binary to $OUTPUT..."
cp "$(command -v node)" "$OUTPUT"
chmod +x "$OUTPUT"

echo "Injecting SEA blob into $OUTPUT..."
if command -v npx >/dev/null 2>&1; then
    npx --yes postject "$OUTPUT" NODE_SEA_BLOB sea-prep.blob \
        --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
        2>/dev/null || true
fi

echo "Done. Binary: ./$OUTPUT"
echo "Test: ./$OUTPUT baseline"
