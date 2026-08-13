# copilot-instruction-architect

Self-improving GitHub Copilot configuration architect. Organises, deduplicates and optimises instructions, skills, prompts and agents while capturing useful repository knowledge with minimal context.

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

## Hybrid deterministic + LLM classification

Instruction Architect uses deterministic analysis as a cheap filter and optionally escalates semantic decisions to an LLM classifier.

- Deterministic layer: extraction, duplicate/overlap/contradiction/discoverability detection, source-of-truth checks.
- LLM layer: semantic classification and ambiguity resolution with structured output validation.

LLM classification is optional and only enabled when environment variables are present:

```sh
export INSTRUCTION_ARCHITECT_LLM_API_KEY=...
export INSTRUCTION_ARCHITECT_LLM_MODEL=gpt-4o-mini
# optional:
export INSTRUCTION_ARCHITECT_LLM_BASE_URL=https://api.openai.com/v1
```

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

## Development

```sh
npm install
npm run lint    # type check
npm test        # run 40 tests
```
