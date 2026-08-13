/**
 * Tier 2 — LLM-graded skill evals.
 *
 * These tests simulate a Copilot session where a developer asks the plugin a
 * natural-language question. The agent's response is graded by an LLM judge
 * against a rubric.
 *
 * Requires EVAL_API_KEY (Anthropic API key). All tests are skipped silently
 * in normal CI when the key is absent — the grader returns a trivial pass.
 *
 * Run with:
 *   EVAL_API_KEY=sk-ant-... npm test -- tests/evals/skill.eval.ts
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { grade } from './grader.js';
import { getBaseline } from '../../src/baseline/baseline.js';
import { audit } from '../../src/commands/commands.js';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SKILL_MD = resolve(
  new URL('../../skills/instruction-architect/SKILL.md', import.meta.url).pathname
);

async function getSkillContext(): Promise<string> {
  try {
    return await readFile(SKILL_MD, 'utf8');
  } catch {
    return '(SKILL.md not found)';
  }
}

// ---------------------------------------------------------------------------
// Audit quality — catches real problems, no hallucinated findings
// ---------------------------------------------------------------------------

describe('eval: skill — audit quality', () => {
  it('identifies real problems without inventing findings', async () => {
    const context = await getSkillContext();

    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-eval-skill-audit-'));
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(
        join(repoRoot, '.github', 'copilot-instructions.md'),
        [
          '## Rules',
          '- Always use single quotes for strings.',
          '- Never use single quotes; always use double quotes.',
          '- The project uses pnpm.',
          '- Always update tests when changing behaviour.',
          '- Always update tests when changing behaviour.',
        ].join('\n')
      );

      const auditResult = await audit(repoRoot);
      const response = [
        `Findings: ${auditResult.findings.length}`,
        ...auditResult.findings.map((f) => `- [${f.type}] ${f.description} → ${f.recommendation}`),
        '',
        `Recommendations: ${auditResult.recommendations.join('; ')}`,
      ].join('\n');

      const result = await grade({
        context,
        prompt: 'Please audit my AI configuration and tell me what to fix.',
        response,
        rubric: [
          'The response identifies at least one contradiction finding (single vs double quotes).',
          'The response identifies at least one duplicate finding (two identical rules).',
          'The response identifies at least one discoverable finding (pnpm usage).',
          'Every finding listed in the response corresponds to a real problem in the configuration.',
          'The response includes actionable recommendations for each finding type.',
        ],
      });

      expect(result.pass, `Score: ${result.score}\n${result.reason}`).toBe(true);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Improvement specificity — proposals are actionable, not generic
// ---------------------------------------------------------------------------

describe('eval: skill — improvement specificity', () => {
  it('produces specific, actionable improvement proposals', async () => {
    const context = await getSkillContext();

    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-eval-skill-improve-'));
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(
        join(repoRoot, '.github', 'copilot-instructions.md'),
        [
          '## Rules',
          '- Test files must use describe/it structure.',
          '- Always update tests when changing behaviour.',
          '- The project uses npm.',
        ].join('\n')
      );

      // Simulate an "improve" response via audit findings.
      const auditResult = await audit(repoRoot);
      const response = auditResult.findings.length > 0
        ? auditResult.findings
            .map((f, i) => `${i + 1}. **${f.type}**: ${f.description}\n   → ${f.recommendation}`)
            .join('\n\n')
        : 'No improvements needed. Configuration looks good.';

      const result = await grade({
        context,
        prompt: 'What improvements do you suggest for my AI configuration?',
        response,
        rubric: [
          'Each suggestion clearly states what to change, not just that something is wrong.',
          'The response does not include vague advice like "improve your instructions".',
          'Discoverable facts (like npm usage) are called out for removal.',
        ],
      });

      expect(result.pass, `Score: ${result.score}\n${result.reason}`).toBe(true);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Baseline awareness — response references actual baseline content
// ---------------------------------------------------------------------------

describe('eval: skill — baseline awareness', () => {
  it('correctly describes baseline security guidance', async () => {
    const context = await getSkillContext();
    const baseline = getBaseline();
    const prompt = 'What does the baseline say about security practices?';

    // The classify command isn't used here — we simulate what the agent would
    // produce from the baseline content directly.
    const response = [
      `Baseline version: ${baseline.version}`,
      '',
      baseline.globalInstructions
        .split('\n')
        .filter((l) => l.includes('Security') || l.includes('secret') || l.includes('sanitise') || l.includes('allowlist'))
        .join('\n'),
    ].join('\n');

    const result = await grade({
      context,
      prompt,
      response,
      rubric: [
        'The response references the baseline version number.',
        'The response mentions not committing secrets or credentials.',
        'The response mentions input sanitisation or validation.',
        'The response does not invent security rules that are not in the baseline.',
      ],
    });

    expect(result.pass, `Score: ${result.score}\n${result.reason}`).toBe(true);
  });
});
