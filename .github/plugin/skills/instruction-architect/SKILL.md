---
name: instruction-architect
description: Improve a repository's GitHub Copilot customisation using the current conversation, repository context, and native Markdown artefacts.
---

# Instruction Architect

Instruction Architect is a GitHub Copilot customisation capability, not a separate runtime.

Use it when a repository would benefit from better persistent Copilot guidance.

## Core model

Copilot
→ Instruction Architect plugin
→ Markdown instructions, skills, prompts, and agents
→ Copilot performs the work

## Operating principles

- Use the current conversation and repository context directly.
- Do not introduce plugin-side reasoning, state, classifiers, prompt engines, or repository scanners.
- Prefer normal Copilot customisation files as the persistent output.
- Preserve useful existing repository guidance.
- Prefer no change over unnecessary customisation.
- Keep changes small, focused, and low-maintenance.
- Avoid duplicating information that already exists or is trivially discoverable from the source.
- Keep global instructions genuinely global.
- Use `applyTo` instructions only when guidance is truly path-specific.
- Introduce skills, prompts, or agents only when they provide a real benefit.

## Placement guidance

Choose the smallest useful destination for each durable piece of knowledge:

- `.github/copilot-instructions.md` for repository-wide guidance
- `.github/instructions/*.instructions.md` for path-specific guidance
- `.github/skills/*/SKILL.md` for reusable multi-step capability
- `.github/prompts/*.prompt.md` for explicit user-invoked operations
- `.github/agents/*.agent.md` only when a distinct agent is genuinely useful
- documentation when human readers benefit
- nowhere when the information is trivial, duplicated, transient, or not worth persisting

## Boundaries

- Do not copy large baselines into a repository unless that is clearly the best representation.
- Do not overwrite existing knowledge merely to make the structure look cleaner.
- Do not add special runtimes, API keys, databases, or configuration files just to support the customisation.
- Do not recreate capabilities Copilot already has.

## Explicit operations

When the user asks for a specific operation, use the matching prompt file in this repository:

- `.github/prompts/seed.prompt.md`
- `.github/prompts/improve.prompt.md`
- `.github/prompts/review.prompt.md`
