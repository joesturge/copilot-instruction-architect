/**
 * Baseline version. Increment when the default baseline rules change to
 * enable safe migration of repository-specific customisations.
 */
export const BASELINE_VERSION = '0.1.0';

/**
 * Generic baseline of good AI-assisted engineering practices.
 *
 * These describe agent behaviour, not repository facts.
 * They are intentionally minimal — only include guidance that agents
 * cannot reliably infer from the repository itself.
 */
export const BASELINE_GLOBAL_INSTRUCTIONS = `\
## Documentation

- Document meaningful changes as you work.
- Keep documentation specific and low-maintenance.
- Avoid documentation duplication.
- Prefer linking to a source of truth rather than copying volatile information.
- Do not document information that can be trivially determined from code or configuration.
- Avoid folder trees and similar representations of repository structure unless they provide real conceptual value.
- Documentation should explain intent, constraints, behaviour and non-obvious decisions rather than restating implementation.
- Update existing documentation rather than creating competing documentation.
- Preserve existing repository writing style.
- Documentation should read like normal human-written engineering documentation, not AI-generated marketing prose.
- Avoid unnecessary introductions, summaries, headings and repetition.
- Avoid exaggerated or overly polished language.

## Testing

- Update tests alongside behavioural changes.
- Add tests for new behaviour where appropriate.
- Keep tests aligned with implementation changes.
- Do not knowingly leave stale tests.
- Do not change tests merely to make an incorrect implementation pass.
- Reuse existing test patterns and helpers.

## Security

- Fix security issues discovered during normal development when reasonably within scope.
- Do not knowingly introduce vulnerabilities to simplify implementation.
- Escalate security issues requiring significant architectural or product decisions rather than making unsafe assumptions.
- Do not let unrelated security concerns cause uncontrolled scope expansion.

## Code quality

- Understand existing implementation before creating abstractions.
- Prefer existing repository patterns.
- Avoid unnecessary abstraction and dependencies.
- Keep changes focused.
- Do not refactor unrelated code without reason.
- Preserve existing behaviour unless the task requires otherwise.

## Collaboration

- Ask the user when important intent cannot be inferred.
- Do not invent requirements.
- Make reasonable low-risk decisions autonomously.
- Explain important trade-offs when they materially affect the implementation.
- Tell the user when scope is expanding.
`;

export interface BaselineEntry {
  version: string;
  globalInstructions: string;
}

export function getBaseline(): BaselineEntry {
  return {
    version: BASELINE_VERSION,
    globalInstructions: BASELINE_GLOBAL_INSTRUCTIONS,
  };
}
