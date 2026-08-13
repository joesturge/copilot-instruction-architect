# Instruction Architect

Improve a repository's GitHub Copilot AI configuration.

Instruction Architect is not a separate AI system. It teaches the current Copilot session how to improve the repository's instructions, skills, prompts, agents and supporting documentation using the current conversation and repository tools.

## Commands

### /instruction-architect seed

Bootstrap, migrate, or restructure AI configuration for this repository using the current Copilot session.

- Review existing AI configuration and relevant docs before proposing changes.
- Use the baseline as reference guidance, not something to copy wholesale.
- Preserve repository-specific knowledge unless it is clearly wrong, duplicated, stale, or better represented elsewhere.
- Choose the smallest useful representation: global instructions, applyTo-scoped instructions, a skill, a prompt, an agent, documentation, or no change.

### /instruction-architect improve

Review existing configuration and propose the smallest useful improvement using the active Copilot conversation.

### /instruction-architect review

List all existing AI configuration files in this repository.

### /instruction-architect baseline

Inspect the current baseline version and content.

## Where knowledge belongs

| Situation | Location |
|-----------|----------|
| Repository-wide behavioural guidance | `.github/copilot-instructions.md` |
| File-type or path-scoped guidance | `.github/instructions/<name>.instructions.md` with `applyTo` |
| On-demand multi-step workflow | `.github/skills/<name>/SKILL.md` |
| Explicitly user-invoked operation | `.github/prompts/<name>.prompt.md` |
| Already discoverable from repository files | Omit — do not add |

## Principles for Copilot

When reasoning about what to persist in the current Copilot session:

- **Preserve existing knowledge.** Read all existing configuration before proposing changes. Never discard repository-specific guidance unless it is clearly wrong or duplicated.
- **Prefer no change.** Only propose a change when there is a clear benefit. An empty proposal is often the correct outcome.
- **Avoid discoverable facts.** Do not add instructions for things the agent can already determine from `package.json`, lockfiles, CI configuration, or repository structure.
- **Avoid duplication.** Do not add knowledge that already appears in existing configuration files.
- **Prefer the smallest useful change.** Add, update, or reorganise only what is necessary.
- **Ignore transient observations.** One-off debugging steps, task-specific details, temporary workarounds, and incidental implementation decisions do not belong in persistent configuration.
- **Let Copilot decide.** Do not rely on plugin-side heuristics or classifiers to make semantic persistence decisions.
- **Act during development.** Instruction Architect is relevant whenever useful durable knowledge surfaces — not only when explicitly invoked. Recognise opportunities during normal development conversations.
