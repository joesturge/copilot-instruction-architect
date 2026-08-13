# copilot-instruction-architect

Self-improving GitHub Copilot configuration architect. Organises, deduplicates and optimises instructions, skills, prompts and agents while capturing useful repository knowledge with minimal context.

## Installation

```sh
gh copilot plugin install joesturge/copilot-instruction-architect
```

## Developer experience

### If you already have Node.js ≥ 20

Install the plugin, then run the CLI directly:

```sh
gh copilot plugin install joesturge/copilot-instruction-architect

# Run any command — Node.js is picked up automatically
instruction-architect seed
instruction-architect audit
```

No extra setup is needed. The session hooks also work out of the box.

### If you do not have Node.js

The session hooks (`sessionStart`, `sessionEnd`) are plain shell / PowerShell scripts and **always work** with no dependencies. Copilot instruction files are plain Markdown — you can read and edit them manually.

The analysis CLI commands (`seed`, `audit`, `improve`, `classify`, `review`, `configure`, `baseline`) require Node.js. You have two options:

**Option A — install Node.js** (recommended):

```sh
# Ubuntu / Debian / WSL
sudo apt install nodejs

# macOS
brew install node

# Windows
winget install OpenJS.NodeJS
```

**Option B — download a pre-built standalone binary** from the [Releases](../../releases) page. These embed Node.js and require nothing extra on the target machine.

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

## Building a standalone binary

Pre-built binaries for linux-x64, darwin-arm64 and win32-x64 are attached to each GitHub release — most users should download one of those instead of building from source.

To build locally (for example, to produce a binary for a platform not covered by the release):

```sh
npm install
npm run build
./build-sea.sh          # Linux / macOS / WSL
.\build-sea.ps1         # Windows PowerShell
```

## Development

```sh
npm install
npm run lint    # type check
npm run build   # compile TypeScript → dist/
npm test        # run 40 tests
```
