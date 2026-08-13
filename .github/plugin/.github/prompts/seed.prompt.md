# Seed Copilot customisation

Architect this repository's Copilot customisation around the following baseline principles.

First inspect the repository and any existing Copilot customisation. Then decide what, if anything, should change.

The goal is not to copy this baseline wholesale into one file. The goal is to decide the best durable representation for each useful idea.

For each piece of knowledge, choose among:

- `.github/copilot-instructions.md`
- `.github/instructions/*.instructions.md` with `applyTo`
- `.github/skills/*/SKILL.md`
- `.github/prompts/*.prompt.md`
- `.github/agents/*.agent.md`
- documentation
- nowhere

Prefer the smallest useful representation.

## Baseline principles

- make the development experience better for the next developer, including developers who do not use Copilot plugins
- make implicit repository knowledge explicit when it has genuine future value
- keep customisations small and focused
- minimise context usage while maximising usefulness
- avoid duplicating information
- don't document things that are trivially discoverable from the source
- prefer linking to the source of truth rather than maintaining duplicate documentation
- keep documentation low-maintenance
- documentation should read like it was written by a human, not an AI
- respect the repository's preferred documentation language and style
- update relevant tests when behaviour changes
- address security issues discovered during development
- preserve useful existing repository guidance
- don't overwrite or discard existing knowledge merely to make the structure look cleaner
- prefer `applyTo` instructions when guidance is genuinely path-specific
- keep global instructions genuinely global
- skills, prompts, and agents should only be introduced when they provide a real benefit
- no change is preferable to unnecessary customisation

## Additional constraints

- preserve useful existing repository guidance unless it is clearly wrong, stale, duplicated, or better represented elsewhere
- avoid introducing plugin runtimes, LLM clients, databases, classifiers, prompt engines, or repository scanners
- avoid documenting transient task details or one-off debugging steps
- prefer normal Copilot customisation files as the persistent output
- if the repository already contains application code that only exists to implement Copilot behaviour, remove it
