# Instruction Architect

Instruction Architect is a markdown-only GitHub Copilot plugin.

It does not ship a TypeScript runtime, commands, LLM client, state system, or plugin-side application logic. The implementation is the Markdown customisation itself plus the minimal plugin metadata required by GitHub Copilot.

## Architecture

```text
Copilot
  ↓
Instruction Architect plugin
  ↓
Markdown instructions / skills / prompts / agents
  ↓
Copilot performs the work
```

## Included artefacts

- `skills/instruction-architect/SKILL.md` — general capability and decision principles
- `.github/prompts/seed.prompt.md` — seed a repository's Copilot customisation from the baseline principles
- `.github/prompts/improve.prompt.md` — identify small durable improvements from the current conversation and repository context
- `.github/prompts/review.prompt.md` — review an existing Copilot customisation against the Instruction Architect principles
- `plugin.json` — minimal Copilot plugin manifest
- `.github/plugin/marketplace.json` — marketplace catalog entry

A minimal `sessionStart` hook is kept only to make the capability available during a session. It adds static awareness text and does not perform reasoning, repository analysis, or state management.

## Design constraints

- no TypeScript runtime
- no TypeScript commands
- no external model or API key
- no state database
- no observation persistence
- no repository scanner
- no prompt-generation code
- no semantic classifier
- no proposal engine
- no plugin-side reasoning
- no runtime code that reads the plugin installation directory

## Usage

Install the plugin from a marketplace or directly from the repository using GitHub Copilot's plugin support.

When you want an explicit operation, use the matching prompt file. For general help deciding what durable Copilot guidance belongs in a repository, use the `instruction-architect` skill.

## Marketplace format

This repository follows the current GitHub Copilot plugin format:

- `plugin.json` at the repository root
- `.github/plugin/marketplace.json` for marketplace metadata
- Markdown-based Copilot artefacts for the actual capability

## Development

This repository is intentionally small. Changes should usually be limited to Markdown customisation files and minimal plugin metadata.
