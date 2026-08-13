/**
 * CLI integration evals (deterministic, no LLM required).
 *
 * Each eval runs a real command against a fixture repository and asserts
 * on behaviour — not just that it ran, but that it produced the correct result.
 *
 * Fixtures live in tests/fixtures/:
 *   empty-repo        — no AI configuration at all
 *   bloated-repo      — many mixed-quality, duplicated rules
 *   contradictory-repo — rules that directly contradict each other
 *   path-scoped-repo  — rules that belong in per-path instruction files
 *   secrets-repo      — copilot-instructions.md containing credential patterns
 *   seeded-repo       — already well-seeded, idempotency target
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { seed } from '../../src/commands/commands.js';
import { readExistingConfig } from '../../src/analyser/analyser.js';
import { readGlobalInstructions } from '../../src/io/writer.js';
import { getBaseline } from '../../src/baseline/baseline.js';

const FIXTURES = resolve(new URL('../fixtures', import.meta.url).pathname);

async function setupFixture(name: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `ia-eval-${name}-`));
  await cp(join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// seed — empty repository
// ---------------------------------------------------------------------------

describe('eval: seed — empty repository', () => {
  let repoRoot: string;
  beforeEach(async () => { repoRoot = await setupFixture('empty-repo'); });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }); });

  it('creates copilot-instructions.md with all baseline sections', async () => {
    const output = await seed(repoRoot);
    expect(output).toContain('copilot-instructions.md');
    const content = await readGlobalInstructions(repoRoot);
    expect(content).toContain('## Documentation');
    expect(content).toContain('## Testing');
    expect(content).toContain('## Security');
    expect(content).toContain('## Code quality');
    expect(content).toContain('## Collaboration');
  });

  it('baseline written to empty repo does not contain technology-specific facts', async () => {
    await seed(repoRoot);
    const content = await readGlobalInstructions(repoRoot);
    // Baseline must not mention specific tools — those are discoverable.
    expect(content).not.toMatch(/\bpnpm\b/);
    expect(content).not.toMatch(/\bnpm\b/);
    expect(content).not.toMatch(/\byarn\b/);
  });
});

// ---------------------------------------------------------------------------
// seed — existing configuration must be preserved without LLM
// ---------------------------------------------------------------------------

describe('eval: seed — preserves existing configuration without LLM', () => {
  let repoRoot: string;
  beforeEach(async () => { repoRoot = await setupFixture('bloated-repo'); });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }); });

  it('does not modify existing copilot-instructions.md when no LLM is configured', async () => {
    const before = await readGlobalInstructions(repoRoot);
    await seed(repoRoot);
    const after = await readGlobalInstructions(repoRoot);
    // Without LLM, seed must not overwrite existing content.
    expect(after).toBe(before);
  });

  it('reports that LLM is required to improve existing configuration', async () => {
    const output = await seed(repoRoot);
    expect(output).toMatch(/llm|api[_-]?key/i);
  });
});

// ---------------------------------------------------------------------------
// seed — idempotency
// ---------------------------------------------------------------------------

describe('eval: seed — idempotency', () => {
  let repoRoot: string;
  beforeEach(async () => { repoRoot = await setupFixture('seeded-repo'); });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }); });

  it('produces identical file content on first and second run', async () => {
    await seed(repoRoot);
    const first = await readGlobalInstructions(repoRoot);
    await seed(repoRoot);
    const second = await readGlobalInstructions(repoRoot);
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// seed — baseline content is safe (no secrets introduced)
// ---------------------------------------------------------------------------

describe('eval: seed — baseline does not introduce secrets', () => {
  let repoRoot: string;
  beforeEach(async () => { repoRoot = await setupFixture('empty-repo'); });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }); });

  it('baseline written to an empty repo contains no secret patterns', async () => {
    await seed(repoRoot);
    const content = await readGlobalInstructions(repoRoot);
    expect(content).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(content).not.toMatch(/ghp_[A-Za-z0-9]{36}/);
    expect(content).not.toContain('supersecretpassword123');
  });
});

// ---------------------------------------------------------------------------
// review — lists existing files
// ---------------------------------------------------------------------------

describe('eval: review — clean repository', () => {
  let repoRoot: string;
  beforeEach(async () => { repoRoot = await setupFixture('empty-repo'); });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }); });

  it('reports zero existing files for an empty repo', async () => {
    const files = await readExistingConfig(repoRoot);
    expect(files).toHaveLength(0);
  });
});

describe('eval: review — seeded repository', () => {
  let repoRoot: string;
  beforeEach(async () => { repoRoot = await setupFixture('seeded-repo'); });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }); });

  it('lists existing copilot-instructions.md', async () => {
    const files = await readExistingConfig(repoRoot);
    expect(files.some((f) => f.path === '.github/copilot-instructions.md')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// baseline quality
// ---------------------------------------------------------------------------

describe('eval: baseline quality', () => {
  it('baseline describes behaviour, not repository facts', () => {
    const { globalInstructions } = getBaseline();
    expect(globalInstructions).toContain('## Documentation');
    expect(globalInstructions).toContain('## Testing');
    expect(globalInstructions).toContain('## Security');
    // Must not mention specific stacks
    expect(globalInstructions).not.toMatch(/\bpnpm\b/);
    expect(globalInstructions).not.toMatch(/\bnpm\b/);
    expect(globalInstructions).not.toMatch(/\byarn\b/);
  });
});
