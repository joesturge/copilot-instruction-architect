# Instruction Architect

A GitHub Copilot plugin that remembers what you and your agents learn during development and turns durable knowledge into persistent AI configuration improvements.

## What it does

Development sessions generate useful knowledge: corrections from the AI, repeated workflows, missing guidance that caused problems. Instruction Architect captures these observations and, at the end of a session, uses an LLM to decide what is worth persisting and where it belongs. The result is a small, targeted improvement to your repository's Copilot configuration.

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

## LLM configuration

Session learning and the `seed`/`improve` commands use an LLM for reasoning. Without one, the plugin can still bootstrap empty repositories and show observations for manual review.

```sh
export INSTRUCTION_ARCHITECT_LLM_API_KEY=sk-...
export INSTRUCTION_ARCHITECT_LLM_MODEL=gpt-4o-mini   # default
# optional:
export INSTRUCTION_ARCHITECT_LLM_BASE_URL=https://api.openai.com/v1
```

Any OpenAI-compatible API is supported.

## Commands

```sh
instruction-architect seed       # bootstrap or improve AI configuration
instruction-architect improve    # propose LLM-driven improvements
instruction-architect review     # list existing AI configuration files
instruction-architect configure  # manage personal preferences
instruction-architect baseline   # inspect baseline version and content
```

## How seed works

`seed` is the main setup command. Its behaviour depends on what already exists:

**Empty repository** — writes the baseline directly. No LLM required.

**Repository with existing configuration** — passes the existing files and the baseline to the LLM, then applies the resulting validated proposal. Existing repository-specific knowledge is preserved. The LLM decides how to combine, reorganise, or deduplicate content. Nothing is overwritten without LLM reasoning.

`seed` is safe to re-run. Running it a second time on an already well-configured repository should produce no changes.

## Handling existing Copilot instructions

If your repository already has `.github/copilot-instructions.md` or other Copilot customisation, `seed` treats it as a migration/augmentation opportunity, not something to replace.

With an LLM configured, the existing content is provided to the LLM alongside the baseline. The LLM decides what to keep, what to add, and what to reorganise. Your repository-specific knowledge is never silently discarded.

Without an LLM, `seed` leaves existing files untouched and reports that an LLM is needed to merge them.

## Session learning

At the end of each session, the session hook:

1. Loads recent observations (recorded during the session by the Copilot agent)
2. Passes them — alongside existing AI configuration — to the LLM
3. The LLM decides what is durable and worth persisting, and where it belongs
4. The resulting validated proposal is either applied or shown for review

The LLM is the filter. It ignores transient details, one-off debugging steps, already-discoverable facts, and information that belongs only to the current task. Only durable knowledge that would genuinely improve the future development experience of the repository is persisted.

**Without an LLM, raw observations are never written directly to Copilot instructions.** Without reasoning, we cannot safely determine what is durable, relevant, or appropriate. In automatic mode without an LLM, the session hook does nothing and reports the limitation.

## How improve works

`instruction-architect improve` asks the LLM to review the existing configuration and propose targeted improvements — removing stale or discoverable content, reorganising instructions into the right mechanisms, or adding missing guidance. Requires `INSTRUCTION_ARCHITECT_LLM_API_KEY`.

## The baseline

The baseline is a set of general good-practice AI-assisted engineering guidelines covering documentation, testing, security, code quality, and collaboration. It describes agent *behaviour*, not technology-specific facts.

View the current baseline:

```sh
instruction-architect baseline
```

The baseline is intentionally minimal. It only contains guidance that agents cannot reliably infer from the repository itself. Technology-specific facts (package manager, language, CI commands) belong in repository-specific configuration if at all — and often they are already discoverable and don't need to be stated.

## What files the plugin may modify

The plugin may only create, update, or delete files within these paths:

- `.github/copilot-instructions.md` — repository-wide Copilot guidance
- `.github/instructions/*.instructions.md` — file-scoped guidance with `applyTo` globs
- `.github/skills/*/SKILL.md` — on-demand multi-step workflows
- `.github/prompts/*.prompt.md` — explicitly user-invoked operations
- `.github/agents/` — agent configuration (rare)

All proposals are validated before application. Unsafe paths, path traversal, and null-byte tricks are rejected mechanically.

## Autonomy modes

Configure how the session hook behaves:

```sh
instruction-architect configure autonomy suggest    # default: show proposals, don't apply
instruction-architect configure autonomy review     # same as suggest
instruction-architect configure autonomy automatic  # apply proposals automatically
instruction-architect configure autonomy disabled   # session hook does nothing
```

In `suggest`/`review` mode, proposals are printed at session end for manual review. In `automatic` mode, validated proposals are applied immediately. Without an LLM, `automatic` mode does nothing and reports the limitation.

## Personal preferences

```sh
instruction-architect configure language en-GB   # documentation language
instruction-architect configure style formal     # writing style
```

Preferences are included in the LLM reasoning context where relevant.

View current preferences:

```sh
instruction-architect configure
```

## Reviewing changes

In `suggest`/`review` mode, proposals are printed at session end. Review them, then apply manually if appropriate:

```sh
# see what exists
instruction-architect review

# apply a proposed improvement
instruction-architect improve
```

Changes can also be reviewed in your normal git workflow: `git diff`, `git status`.

## If LLM reasoning is unavailable

Without `INSTRUCTION_ARCHITECT_LLM_API_KEY`:

- `seed` writes the baseline to empty repositories
- `seed` on repositories with existing configuration reports that an LLM is needed
- `improve` reports that an LLM is needed
- Session hook in `suggest`/`review` mode shows observations for manual consideration
- Session hook in `automatic` mode does nothing and reports the limitation
- No observations are ever written directly to Copilot instructions

## WSL

The plugin handles the [CLAUDE_PLUGIN_ROOT backslash bug](https://github.com/obra/superpowers/issues/2091) in Copilot Chat on WSL. Hook scripts normalise the path before use.

## Development

```sh
npm install
npm test        # run all tests
```
