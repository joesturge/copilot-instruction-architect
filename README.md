# Instruction Architect

A GitHub Copilot plugin that teaches Copilot how to improve a repository's own instructions, skills, prompts, agents and supporting documentation.

## What it does

Development sessions generate useful knowledge: corrections from the AI, repeated workflows, missing guidance that caused problems. Instruction Architect helps the current Copilot session inspect that knowledge, inspect existing repository guidance, and decide what is worth persisting and where it belongs.

The `sessionStart` hook injects a small awareness context so Copilot recognises when to use the skill during normal development — not only when explicitly asked.

Repositories with well-maintained AI configuration benefit all future contributors — including those who don't use the plugin themselves.

## Installation

```sh
gh copilot plugin install joesturge/copilot-instruction-architect
```

## Requirements

The CLI commands require **Node.js ≥ 20**:

```sh
# Ubuntu / Debian / WSL
sudo apt install nodejs

# macOS
brew install node

# Windows
winget install OpenJS.NodeJS
```

The `sessionStart` hook is a plain shell/PowerShell script and does not need Node.js.

## Architecture

Instruction Architect does **not** call a separate LLM API. There is no second context window, no observation database, and no session-end processing.

The intended reasoning flow is:

```
sessionStart hook injects small static awareness context
    ↓
normal Copilot session
    ↓
Copilot decides when Instruction Architect is relevant
    ↓
instruction-architect skill
    ↓
Copilot reasons using its own context and repository tools
    ↓
small persistent improvement
```

The plugin stays thin. It provides baseline guidance, lifecycle hooks, and small helper commands. Semantic reasoning happens inside the active Copilot session.

## Commands

```sh
instruction-architect seed       # show Copilot-native seeding guidance
instruction-architect improve    # show Copilot-native improvement guidance
instruction-architect review     # list existing AI configuration files
instruction-architect baseline   # inspect baseline version and content
```

## How seed works

`seed` prepares the current Copilot session to bootstrap or restructure AI configuration:

- It shows existing repository AI configuration (if any)
- It shows the baseline version
- It reminds Copilot to use the current conversation and repository tools
- It focuses Copilot on making the smallest useful change

This keeps the baseline as reference guidance rather than copying it wholesale into global instructions. Copilot decides what should be global, path-scoped, skill-based, prompt-based, agent-based, documented elsewhere, or omitted entirely.

`seed` is safe to re-run. Running it a second time on an already well-configured repository should produce no changes.

## Handling existing Copilot instructions

If your repository already has `.github/copilot-instructions.md` or other Copilot customisation, `seed` treats it as a migration/augmentation opportunity, not something to replace.

The current Copilot session should review the existing content alongside the baseline and decide what to keep, what to add, and what to reorganise. Repository-specific knowledge should never be silently discarded.

## How improve works

`instruction-architect improve` prepares the active Copilot session to review the existing configuration and propose targeted improvements — removing stale or discoverable content, reorganising instructions into the right mechanisms, or adding missing durable guidance.

## The baseline

The baseline is a set of general good-practice AI-assisted engineering guidelines covering documentation, testing, security, code quality, and collaboration. It describes agent *behaviour*, not technology-specific facts.

View the current baseline:

```sh
instruction-architect baseline
```

The baseline is intentionally minimal. It only contains guidance that agents cannot reliably infer from the repository itself. Technology-specific facts (package manager, language, CI commands) belong in repository-specific configuration if at all — and often they are already discoverable and don't need to be stated.

## What files the plugin may modify

Instruction Architect is primarily guidance, but when used to make changes it should focus on these paths:

- `.github/copilot-instructions.md` — repository-wide Copilot guidance
- `.github/instructions/*.instructions.md` — file-scoped guidance with `applyTo` globs
- `.github/skills/*/SKILL.md` — on-demand multi-step workflows
- `.github/prompts/*.prompt.md` — explicitly user-invoked operations
- `.github/agents/` — agent configuration (rare)

## What the plugin does not do

- No separate LLM API key
- No model configuration
- No direct `chat/completions` calls
- No second reasoning context window
- No autonomous semantic classification in TypeScript
- No observation database or session-end processing

## WSL

The plugin handles the [CLAUDE_PLUGIN_ROOT backslash bug](https://github.com/obra/superpowers/issues/2091) in Copilot Chat on WSL. Hook scripts normalise the path before use.

## Development

```sh
npm install
npm test        # run all tests
```

