# copilot-instruction-architect

Self-improving GitHub Copilot configuration architect. Organises, deduplicates and optimises instructions, skills, prompts and agents while capturing useful repository knowledge with minimal context.

## Installation

```sh
gh copilot plugin install joesturge/copilot-instruction-architect
```

## Runtime requirements

The plugin works in two modes:

### Shell-only mode (no Node.js required)

Session hooks (`sessionStart`, `sessionEnd`) are plain shell scripts. They work on Linux, macOS, Windows (PowerShell) and WSL with no runtime dependencies.

The Copilot instruction files — `.github/copilot-instructions.md`, `skills/`, `prompts/` — are plain Markdown and work without installing anything.

### Full mode (Node.js ≥ 20 required)

The analysis CLI (`seed`, `audit`, `improve`, `classify`, `review`, `configure`, `baseline`) requires Node.js. Install it with your system package manager:

```sh
# Ubuntu / Debian / WSL
sudo apt install nodejs

# macOS
brew install node

# Windows
winget install OpenJS.NodeJS
```

Alternatively, download a standalone binary from the [Releases](../../releases) page — this embeds Node.js and requires nothing extra.

## Commands

```sh
instruction-architect seed       # bootstrap / migrate / normalise
instruction-architect audit      # analyse without modifying
instruction-architect improve    # find and propose improvements
instruction-architect classify "Always update tests when changing behaviour."
instruction-architect review     # full configuration review
instruction-architect configure  # manage personal preferences
instruction-architect baseline   # inspect baseline version
```

## WSL

The plugin handles the [CLAUDE_PLUGIN_ROOT backslash bug](https://github.com/obra/superpowers/issues/2091) found in Copilot Chat on WSL. Hook scripts normalise the path before use so forward-slash resolution works correctly under `/bin/sh`.

## Building a standalone binary (optional)

```sh
npm run build
./build-sea.sh          # Linux / macOS / WSL
.\build-sea.ps1         # Windows PowerShell
```

Pre-built binaries for linux-x64, darwin-arm64 and win32-x64 are attached to each GitHub release.

## Development

```sh
npm install
npm run lint    # type check
npm run build   # compile TypeScript → dist/
npm test        # run 40 tests
```
