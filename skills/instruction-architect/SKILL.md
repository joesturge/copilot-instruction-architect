# Instruction Architect

Improve a repository's GitHub Copilot AI configuration.

The plugin's job is to remember what humans and agents learn. The LLM's job is to decide what is worth preserving, where it belongs, and when no change is appropriate.

## Commands

### /instruction-architect seed

Bootstrap, migrate, or improve AI configuration for this repository.

- Empty repository: writes the baseline directly
- Repository with existing configuration: passes existing files and the baseline to the LLM, which decides how to combine, reorganise, or deduplicate — existing repository-specific knowledge is preserved
- Safe to re-run; produces no change when configuration is already good

### /instruction-architect improve

Ask the LLM to review existing configuration and propose improvements. Requires LLM configuration.

### /instruction-architect review

List all existing AI configuration files in this repository.

### /instruction-architect configure [key] [value]

Manage personal preferences:

- `language` — documentation language (e.g. `en-GB`, `en-US`)
- `style` — writing style (`natural`, `formal`)
- `autonomy` — `suggest` (default), `review`, `automatic`, `disabled`

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

## Principles for the LLM

When reasoning about what to persist:

- **Preserve existing knowledge.** Read all existing configuration before proposing changes. Never discard repository-specific guidance unless it is clearly wrong or duplicated.
- **Prefer no change.** Only propose a change when there is a clear benefit. An empty proposal is often the correct outcome.
- **Avoid discoverable facts.** Do not add instructions for things the agent can already determine from `package.json`, lockfiles, CI configuration, or repository structure.
- **Avoid duplication.** Do not add knowledge that already appears in existing configuration files.
- **Prefer the smallest useful change.** Add, update, or reorganise only what is necessary.
- **Ignore transient observations.** One-off debugging steps, task-specific details, temporary workarounds, and incidental implementation decisions do not belong in persistent configuration.
- **Let the LLM decide.** Do not use heuristics or classifiers to pre-filter. The LLM reasons about all existing context and decides.

## Session learning

At session end, accumulated observations are passed to the LLM alongside existing AI configuration. The LLM decides what is durable enough to persist. Without LLM reasoning, no observations are written automatically — raw observations are never turned into persistent instructions without LLM synthesis.
