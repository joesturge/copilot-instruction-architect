/**
 * Tier 1 — Classifier accuracy eval (deterministic, no LLM required).
 *
 * A labelled dataset of 26 knowledge items with expected classifications.
 * The classifier must correctly label ≥ 85% of items (22/26).
 *
 * These labels represent the intended design of the classifier:
 *  - Discoverable facts → NONE
 *  - Repository-wide behavioural rules → GLOBAL_INSTRUCTION
 *  - File-scoped behavioural rules → PATH_INSTRUCTION
 *  - Multi-step workflows → SKILL
 *  - Explicitly user-invoked operations → PROMPT
 *  - Factual-only, no behavioural guidance → DOCUMENTATION_ONLY
 */

import { describe, it, expect } from 'vitest';
import { classify } from '../../src/classifier/classifier.js';
import type { Classification } from '../../src/classifier/types.js';

interface LabelledItem {
  content: string;
  expected: Classification;
  /** Brief rationale for the label (for test failure messages). */
  rationale: string;
}

const LABELLED_DATASET: LabelledItem[] = [
  // --- NONE: discoverable facts ---
  {
    content: 'The project uses pnpm.',
    expected: 'NONE',
    rationale: 'Discoverable from lockfile/package.json.',
  },
  {
    content: 'This repository is written in TypeScript.',
    expected: 'NONE',
    rationale: 'Discoverable from tsconfig.json and file extensions.',
  },
  {
    content: 'The package manager is pnpm.',
    expected: 'NONE',
    rationale: 'Discoverable from pnpm-lock.yaml.',
  },
  {
    content: 'This repo uses a monorepo structure using Nx.',
    expected: 'NONE',
    rationale: 'Discoverable from nx.json and directory layout.',
  },
  {
    content: 'Uses yarn as the package manager.',
    expected: 'NONE',
    rationale: 'Discoverable from yarn.lock.',
  },

  // --- GLOBAL_INSTRUCTION: repository-wide behavioural rules ---
  {
    content: 'Always update tests when changing behaviour.',
    expected: 'GLOBAL_INSTRUCTION',
    rationale: 'Stable behavioural rule applying to the whole codebase.',
  },
  {
    content: 'Never commit secrets or credentials to the repository.',
    expected: 'GLOBAL_INSTRUCTION',
    rationale: 'Security policy applying across all files.',
  },
  {
    content: 'Prefer functional patterns over imperative loops.',
    expected: 'GLOBAL_INSTRUCTION',
    rationale: 'Code style preference applying to all code.',
  },
  {
    content: 'Always add JSDoc to exported functions.',
    expected: 'GLOBAL_INSTRUCTION',
    rationale: 'Documentation rule applying across the codebase.',
  },
  {
    content: 'Avoid introducing breaking changes without a major version bump.',
    expected: 'GLOBAL_INSTRUCTION',
    rationale: 'Versioning policy applying to all public APIs.',
  },
  {
    content: 'Keep pull requests small and focused on a single concern.',
    expected: 'GLOBAL_INSTRUCTION',
    rationale: 'Collaboration rule applying to all PRs.',
  },
  {
    content: 'Do not use console.log in production code.',
    expected: 'GLOBAL_INSTRUCTION',
    rationale: 'Code quality rule applying across the codebase.',
  },

  // --- PATH_INSTRUCTION: file-scoped behavioural rules ---
  {
    content: 'Test files must use describe/it structure.',
    expected: 'PATH_INSTRUCTION',
    rationale: 'Explicitly scoped to test files.',
  },
  {
    content: 'API files must include OpenAPI annotations.',
    expected: 'PATH_INSTRUCTION',
    rationale: 'Explicitly scoped to API files.',
  },
  {
    content: 'Migration files must be reversible and include a down() method.',
    expected: 'PATH_INSTRUCTION',
    rationale: 'Explicitly scoped to migration files.',
  },

  // --- SKILL: multi-step procedural workflows ---
  {
    content: 'To release: first run tests, then build, then tag the commit, and finally push to npm.',
    expected: 'SKILL',
    rationale: 'Multi-step, ordered workflow loaded on demand.',
  },
  {
    content: 'The deployment workflow: run CI pipeline, then deploy to staging, verify, then promote to production.',
    expected: 'SKILL',
    rationale: 'Describes a multi-stage procedural pipeline.',
  },
  {
    content: 'Database migration process:\n1. Write the migration\n2. Test locally\n3. Open a PR\n4. Merge after review',
    expected: 'SKILL',
    rationale: 'Numbered list of steps — procedural workflow.',
  },

  // --- PROMPT: explicitly user-invoked operations ---
  {
    content: 'Audit the current test coverage and generate a report of uncovered modules.',
    expected: 'PROMPT',
    rationale: 'Audit/report operation explicitly triggered by user.',
  },
  {
    content: 'Review all open TODOs and generate a summary with suggested priorities.',
    expected: 'PROMPT',
    rationale: 'Review and summarise — user-invoked operation.',
  },
  {
    content: 'Scan the codebase for deprecated API usage and list occurrences.',
    expected: 'PROMPT',
    rationale: 'Scan operation — user-invoked.',
  },

  // --- DOCUMENTATION_ONLY: factual but not behavioural ---
  {
    content: 'The repository was created in 2023.',
    expected: 'DOCUMENTATION_ONLY',
    rationale: 'Historical fact with no behavioural implication.',
  },
  {
    content: 'This project is maintained by the platform team.',
    expected: 'DOCUMENTATION_ONLY',
    rationale: 'Ownership fact — no behavioural guidance.',
  },
  {
    content: 'The API is versioned using /v1, /v2 URL prefixes.',
    expected: 'DOCUMENTATION_ONLY',
    rationale: 'Descriptive fact about existing structure.',
  },
  {
    content: 'There are currently three micro-services: auth, billing, and notifications.',
    expected: 'DOCUMENTATION_ONLY',
    rationale: 'Inventory fact discoverable from directory layout.',
  },
  {
    content: 'The database is PostgreSQL 15.',
    expected: 'DOCUMENTATION_ONLY',
    rationale: 'Infrastructure fact with no behavioural guidance.',
  },
];

const PASS_THRESHOLD = 0.85;

describe('eval: classifier accuracy', () => {
  it(`correctly labels ≥ ${Math.round(PASS_THRESHOLD * 100)}% of the labelled dataset`, () => {
    const results = LABELLED_DATASET.map((item) => ({
      item,
      actual: classify({ content: item.content }).classification,
      correct: classify({ content: item.content }).classification === item.expected,
    }));

    const correct = results.filter((r) => r.correct).length;
    const total = results.length;
    const accuracy = correct / total;

    // Build a failure message listing every wrong prediction.
    const failures = results
      .filter((r) => !r.correct)
      .map(
        (r) =>
          `  [WRONG] "${r.item.content.slice(0, 60)}"\n` +
          `    expected: ${r.item.expected}  got: ${r.actual}\n` +
          `    rationale: ${r.item.rationale}`
      )
      .join('\n');

    expect(accuracy, `Accuracy ${correct}/${total} (${Math.round(accuracy * 100)}%) below ${Math.round(PASS_THRESHOLD * 100)}% threshold.\n${failures}`).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });

  // Individual sanity checks for the most critical classifications.

  it('classifies discoverable package-manager facts as NONE', () => {
    const discoverableItems = LABELLED_DATASET.filter((i) => i.expected === 'NONE');
    for (const item of discoverableItems) {
      const result = classify({ content: item.content });
      expect(result.classification, `"${item.content}" — ${item.rationale}`).toBe('NONE');
    }
  });

  it('never classifies a discoverable fact as GLOBAL_INSTRUCTION', () => {
    const discoverableItems = LABELLED_DATASET.filter((i) => i.expected === 'NONE');
    for (const item of discoverableItems) {
      const result = classify({ content: item.content });
      expect(result.classification, `"${item.content}" should not be a GLOBAL_INSTRUCTION`).not.toBe('GLOBAL_INSTRUCTION');
    }
  });

  it('classifies multi-step workflows as SKILL', () => {
    const skillItems = LABELLED_DATASET.filter((i) => i.expected === 'SKILL');
    const correct = skillItems.filter(
      (i) => classify({ content: i.content }).classification === 'SKILL'
    ).length;
    // Allow one miss — workflows are inherently ambiguous.
    expect(correct).toBeGreaterThanOrEqual(skillItems.length - 1);
  });

  it('classifies security rules as GLOBAL_INSTRUCTION', () => {
    const securityRule = LABELLED_DATASET.find((i) =>
      i.content.includes('secrets or credentials')
    )!;
    const result = classify({ content: securityRule.content });
    expect(result.classification).toBe('GLOBAL_INSTRUCTION');
  });
});
