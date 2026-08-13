# Instruction Architect

Analyse and improve a repository's GitHub Copilot AI configuration.

## Commands

### /instruction-architect seed

Bootstrap, migrate, or normalise AI configuration for this repository.

- Analyses existing AI configuration files (`copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, etc.)
- Extracts and classifies knowledge items
- Deduplicates and removes discoverable facts
- Writes minimal, well-organised Copilot configuration
- Safe to re-run — idempotent

### /instruction-architect audit

Analyse existing AI configuration without modifying it. Reports:
- Duplicate rules
- Contradictions
- Overly broad or undiscoverable guidance
- Misplaced instructions
- Estimated context reduction potential

### /instruction-architect improve

Find and propose specific improvements to the current configuration.

### /instruction-architect classify "<knowledge>"

Classify a piece of knowledge and explain why it belongs where it does.

Example:
```
/instruction-architect classify "All API changes require updating contract tests."
```

### /instruction-architect review

Full review of all AI configuration files.

### /instruction-architect configure [key] [value]

Manage personal preferences:
- `language` — documentation language (e.g. `en-GB`, `en-US`)
- `style` — writing style (`natural`, `formal`)
- `autonomy` — `suggest`, `review`, `automatic`, `disabled`

### /instruction-architect baseline

Inspect the baseline version and default guidance rules.

## Classification guide

| Situation | Output |
|-----------|--------|
| Already discoverable from repo | `NONE` — do not add |
| Repository-wide behaviour | `GLOBAL_INSTRUCTION` |
| File-scoped behaviour | `PATH_INSTRUCTION` with `applyTo` |
| Multi-step workflow | `SKILL` |
| Explicit user operation | `PROMPT` |
| Distinct autonomous role | `AGENT` (rare) |

## Principles

- Make the smallest amount of AI configuration necessary to make the agent substantially better.
- If the agent can discover something from the repository, do not waste persistent context telling it.
- Prefer the narrowest mechanism that provides the required behaviour.
- Preserve intent rather than preserving existing files.
