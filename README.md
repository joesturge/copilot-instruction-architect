# copilot-instruction-architect

Repository AI-knowledge architect. Discovers repository knowledge, semantically evaluates what is useful, deduplicates/conflict-checks it, and proposes the smallest useful AI configuration changes.

## Installation

```sh
gh copilot plugin install joesturge/copilot-instruction-architect
```

## Requirements

The analysis CLI (`seed`, `audit`, `improve`, `classify`, `review`, `configure`, `baseline`) requires **Node.js ≥ 20**. Install it before running any commands:

```sh
# Ubuntu / Debian / WSL
sudo apt install nodejs

# macOS
brew install node

# Windows
winget install OpenJS.NodeJS
```

The session hooks (`sessionStart`, `sessionEnd`) are plain shell / PowerShell scripts and work without Node.js.

## Knowledge pipeline (deterministic + LLM)

Instruction Architect manages repository knowledge through one shared pipeline used by `seed`, `audit`, `improve`, and session hooks:

1. Discover knowledge from repository AI guidance sources
2. Semantically evaluate usefulness and representation options
3. Synthesize via deduplication / discoverability / conflict checks
4. Decide representation (global, path, skill, prompt, agent, or omit)
5. Propose minimal file changes

Deterministic code handles mechanical facts (paths, extraction, frontmatter, metadata, validation). LLM calls are optional and only used for semantic judgement where needed:

```sh
export INSTRUCTION_ARCHITECT_LLM_API_KEY=...
export INSTRUCTION_ARCHITECT_LLM_MODEL=gpt-4o-mini
# optional:
export INSTRUCTION_ARCHITECT_LLM_BASE_URL=https://api.openai.com/v1
```

## Commands

```sh
instruction-architect seed       # bootstrap / migrate / normalise
instruction-architect audit      # evaluate repository knowledge without modifying
instruction-architect improve    # find and propose improvements
instruction-architect classify "Always update tests when changing behaviour."
instruction-architect review     # full repository AI-knowledge review
instruction-architect configure  # manage personal preferences
instruction-architect baseline   # inspect baseline version
```

## WSL

The plugin handles the [CLAUDE_PLUGIN_ROOT backslash bug](https://github.com/obra/superpowers/issues/2091) found in Copilot Chat on WSL. Hook scripts normalise the path before use so forward-slash resolution works correctly under `/bin/sh`.

## Development

```sh
npm install
npm run lint    # type check
npm test        # run 40 tests
```
