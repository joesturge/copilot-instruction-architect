import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { seed, improve, review } from '../src/commands/commands.js';

async function createTempRepo(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ia-test-'));
}

describe('seed', () => {
  it('uses the current Copilot session for reasoning guidance', async () => {
    const repoRoot = await createTempRepo();
    try {
      const output = await seed(repoRoot);
      expect(output).toContain('current Copilot session');
      expect(output).toContain('No separate LLM API');
      await expect(
        access(join(repoRoot, '.github', 'copilot-instructions.md'))
      ).rejects.toThrow();
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('is idempotent — re-running does not cause churn', async () => {
    const repoRoot = await createTempRepo();
    try {
      const firstRun = await seed(repoRoot);
      await expect(
        access(join(repoRoot, '.github', 'copilot-instructions.md'))
      ).rejects.toThrow();
      const secondRun = await seed(repoRoot);
      await expect(
        access(join(repoRoot, '.github', 'copilot-instructions.md'))
      ).rejects.toThrow();
      expect(firstRun).toBe(secondRun);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('lists existing AI configuration files without modifying them', async () => {
    const repoRoot = await createTempRepo();
    const repoSpecificContent = '## Repository Rules\n\n- Always run integration tests before merging.\n';
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(
        join(repoRoot, '.github', 'copilot-instructions.md'),
        repoSpecificContent
      );
      const output = await seed(repoRoot);
      expect(output).toContain('.github/copilot-instructions.md');
      expect(output).toContain('Preserve valid repository-specific guidance');
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('reports when no AI configuration exists yet', async () => {
    const repoRoot = await createTempRepo();
    try {
      const output = await seed(repoRoot);
      expect(output).toContain('Existing AI configuration files: none found.');
      await expect(
        access(join(repoRoot, '.github', 'copilot-instructions.md'))
      ).rejects.toThrow();
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });
});

describe('improve', () => {
  it('returns Copilot-native review guidance', async () => {
    const repoRoot = await createTempRepo();
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(join(repoRoot, '.github', 'copilot-instructions.md'), '## Rules\n');
      const output = await improve(repoRoot);
      expect(output).toContain('active Copilot conversation');
      expect(output).toContain('.github/copilot-instructions.md');
      expect(output).toContain('remove duplicated, contradictory, stale, or discoverable content');
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });
});

describe('review', () => {
  it('lists discovered configuration files', async () => {
    const repoRoot = await createTempRepo();
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(join(repoRoot, '.github', 'copilot-instructions.md'), '## Test\n');
      const output = await review(repoRoot);
      expect(output).toContain('Existing files (1)');
      expect(output).toContain('.github/copilot-instructions.md');
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });
});
