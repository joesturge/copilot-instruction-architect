# Instruction Architect

A GitHub Copilot plugin that teaches Copilot how to improve a repository's own instructions, skills, prompts, agents and supporting documentation.

## What it does

Development sessions generate useful knowledge: corrections from the AI, repeated workflows, missing guidance that caused problems. Instruction Architect helps the current Copilot session inspect that knowledge, inspect existing repository guidance, and decide what is worth persisting and where it belongs.

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

Session hooks (`sessionStart`, `sessionEnd`) are plain shell/PowerShell scripts and do not need Node.js.

## Architecture

Instruction Architect does **not** call a separate LLM API.

It is a GitHub Copilot plugin, so the intended reasoning flow is:

1. Copilot loads the plugin's skill and hooks
2. Copilot inspects the current repository and conversation
3. Copilot decides whether anything should persist
4. Copilot makes or proposes the smallest useful repository change

The plugin code stays thin. It provides baseline guidance, lightweight state, lifecycle hooks, and small helper commands. The semantic reasoning happens inside the active Copilot session.

## Commands

```sh
instruction-architect seed       # show Copilot-native seeding guidance
instruction-architect improve    # show Copilot-native improvement guidance
instruction-architect review     # list existing AI configuration files
instruction-architect configure  # manage personal preferences
instruction-architect baseline   # inspect baseline version and content
```

## How seed works

`seed` prepares the current Copilot session to bootstrap or restructure AI configuration:

- It shows existing repository AI configuration (if any)
- It shows the baseline version and preferences
- It reminds Copilot to use the current conversation and repository tools
- It focuses Copilot on making the smallest useful change

This keeps the baseline as reference guidance rather than copying it wholesale into global instructions. Copilot decides what should be global, path-scoped, skill-based, prompt-based, agent-based, documented elsewhere, or omitted entirely.

`seed` is safe to re-run. Running it a second time on an already well-configured repository should produce no changes.

## Handling existing Copilot instructions

If your repository already has `.github/copilot-instructions.md` or other Copilot customisation, `seed` treats it as a migration/augmentation opportunity, not something to replace.

The current Copilot session should review the existing content alongside the baseline and decide what to keep, what to add, and what to reorganise. Repository-specific knowledge should never be silently discarded.

## Session learning

At the end of each session, the session hook can:

1. Load recent observations captured by the plugin
2. Show them back to the active Copilot session as a reminder
3. Prompt Copilot to decide whether any of them belong in persistent repository guidance

Copilot is the filter. It should ignore transient details, one-off debugging steps, already-discoverable facts, and information that belongs only to the current task. Only durable knowledge that would genuinely improve future development should be persisted.

**Raw observations are never written directly to Copilot instructions.** The hook does not perform autonomous reasoning or automatic repository edits.

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

## Autonomy modes

Configure how the session hook behaves:

```sh
instruction-architect configure autonomy suggest    # default: show session reminders
instruction-architect configure autonomy review     # same as suggest
instruction-architect configure autonomy automatic  # legacy alias; still keeps reasoning in-session
instruction-architect configure autonomy disabled   # session hook does nothing
```

In all modes, semantic reasoning remains in the active Copilot session. `disabled` suppresses hook reminders entirely.

## Personal preferences

```sh
instruction-architect configure language en-GB   # documentation language
instruction-architect configure style formal     # writing style
```

Preferences are included in the plugin's guidance output where relevant.

View current preferences:

```sh
instruction-architect configure
```

## Reviewing changes

Use the skill and commands to review what exists, then decide in the active Copilot session whether to make changes:

```sh
# see what exists
instruction-architect review

# show improvement guidance for the current session
instruction-architect improve
```

Changes can also be reviewed in your normal git workflow: `git diff`, `git status`.

## What the plugin does not do

- No separate LLM API key
- No model configuration
- No direct `chat/completions` calls
- No second reasoning context window
- No autonomous semantic classification in TypeScript
- No automatic persistence of raw observations

## WSL

The plugin handles the [CLAUDE_PLUGIN_ROOT backslash bug](https://github.com/obra/superpowers/issues/2091) in Copilot Chat on WSL. Hook scripts normalise the path before use.

## Development

```sh
npm install
npm test        # run all tests
```
