/**
 * Tier 1 — CLI integration evals (deterministic, no LLM required).
 *
 * Each eval runs a real CLI command against a synthetic fixture repository and
 * asserts on the quality of the output — not just that it ran, but that it
 * produced the right result.
 *
 * Fixtures live in tests/fixtures/ and represent specific repo states:
 *   empty-repo        — no AI configuration at all
 *   bloated-repo      — 30+ mixed-quality, highly duplicated rules
 *   contradictory-repo — rules that directly contradict each other
 *   path-scoped-repo  — rules that belong in per-path instruction files
 *   secrets-repo      — copilot-instructions.md containing credential patterns
 *   seeded-repo       — already well-seeded, idempotency target
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cp, mkdtemp, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { seed, audit } from '../../src/commands/commands.js';
import { readGlobalInstructions } from '../../src/io/writer.js';

const FIXTURES = resolve(new URL('../fixtures', import.meta.url).pathname);

/**
 * Copy a fixture into a fresh temp directory so each test gets an isolated,
 * writable working tree.
 */
async function setupFixture(name: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `ia-eval-${name}-`));
  await cp(join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// seed evals
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
});

describe('eval: seed — bloated repository', () => {
  let repoRoot: string;
  beforeEach(async () => { repoRoot = await setupFixture('bloated-repo'); });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }); });

  it('does not propagate all bloated rules verbatim into output', async () => {
    const inputContent = await readFile(join(repoRoot, '.github', 'copilot-instructions.md'), 'utf8');
    await seed(repoRoot);
    const outputContent = await readGlobalInstructions(repoRoot);
    // The bloated fixture has many near-duplicate lines. Seed should NOT copy
    // all of them into the repository-specific section — discoverable facts
    // and duplicates must be filtered.
    const inputBullets = (inputContent.match(/^- .+/gm) ?? []).map((l) => l.trim());
    // Count how many of the original bloated bullets appear verbatim in output.
    const verbatimCount = inputBullets.filter((b) => outputContent.includes(b)).length;
    // Most (>50%) of the bloated bullets should be suppressed or merged.
    expect(verbatimCount).toBeLessThan(inputBullets.length * 0.5);
  });

  it('removes discoverable facts (package manager, language)', async () => {
    await seed(repoRoot);
    const content = await readGlobalInstructions(repoRoot);
    // "The project uses pnpm" and similar are discoverable — must not appear
    // as explicit instruction lines in the output.
    const discoverableLines = (content.match(/^- .*(uses pnpm|use pnpm|package manager is)/gim) ?? []);
    expect(discoverableLines).toHaveLength(0);
  });
});

describe('eval: seed — idempotency', () => {
  let repoRoot: string;
  beforeEach(async () => { repoRoot = await setupFixture('seeded-repo'); });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }); });

  it('produces identical output on first and second run', async () => {
    await seed(repoRoot);
    const first = await readGlobalInstructions(repoRoot);
    await seed(repoRoot);
    const second = await readGlobalInstructions(repoRoot);
    expect(first).toBe(second);
  });

  it('does not duplicate baseline sections on re-run', async () => {
    await seed(repoRoot);
    await seed(repoRoot);
    const content = await readGlobalInstructions(repoRoot);
    // Count occurrences of the Testing section heading
    const testingHeadings = (content.match(/^## Testing/gm) ?? []).length;
    expect(testingHeadings).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// audit evals
// ---------------------------------------------------------------------------

describe('eval: audit — clean repository', () => {
  let repoRoot: string;
  beforeEach(async () => { repoRoot = await setupFixture('empty-repo'); });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }); });

  it('reports zero findings for an empty repo (no false positives)', async () => {
    const result = await audit(repoRoot);
    expect(result.findings).toHaveLength(0);
    expect(result.existingFiles).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Secret redaction eval
// ---------------------------------------------------------------------------

describe('eval: seed — secrets repository', () => {
  let repoRoot: string;
  beforeEach(async () => { repoRoot = await setupFixture('secrets-repo'); });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }); });

  it('does not propagate known secret patterns into output', async () => {
    await seed(repoRoot);
    const content = await readGlobalInstructions(repoRoot);
    // AWS-style access key pattern
    expect(content).not.toMatch(/AKIA[0-9A-Z]{16}/);
    // GitHub PAT pattern
    expect(content).not.toMatch(/ghp_[A-Za-z0-9]{36}/);
  });

  it('does not surface raw credential text as an instruction rule', async () => {
    await seed(repoRoot);
    const content = await readGlobalInstructions(repoRoot);
    expect(content).not.toContain('supersecretpassword123');
  });
});
