import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { seed, applyProposal } from '../src/commands/commands.js';
import { readGlobalInstructions } from '../src/io/writer.js';
import { isSafePath } from '../src/reasoner/llm.js';

async function createTempRepo(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ia-test-'));
}

describe('seed', () => {
  it('does not write baseline files without LLM in an empty repository', async () => {
    const repoRoot = await createTempRepo();
    try {
      const output = await seed(repoRoot);
      expect(output).toMatch(/llm|api[_-]?key/i);
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
      const secondRun = await seed(repoRoot);
      expect(firstRun).toBe(secondRun);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('does not overwrite existing copilot-instructions.md without LLM', async () => {
    const repoRoot = await createTempRepo();
    const repoSpecificContent = '## Repository Rules\n\n- Always run integration tests before merging.\n';
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(
        join(repoRoot, '.github', 'copilot-instructions.md'),
        repoSpecificContent
      );
      await seed(repoRoot);
      // Without LLM, existing content must be preserved.
      const content = await readGlobalInstructions(repoRoot);
      expect(content).toBe(repoSpecificContent);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('does not write baseline to a repo that has other AI config but no copilot-instructions.md', async () => {
    const repoRoot = await createTempRepo();
    try {
      await writeFile(
        join(repoRoot, 'AGENTS.md'),
        '## Testing\n\n- Always update tests when changing behaviour.\n'
      );
      const output = await seed(repoRoot);
      expect(output).toMatch(/llm|api[_-]?key/i);
      await expect(
        access(join(repoRoot, '.github', 'copilot-instructions.md'))
      ).rejects.toThrow();
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });
});

describe('applyProposal', () => {
  it('creates a file for a create proposal', async () => {
    const repoRoot = await createTempRepo();
    try {
      await applyProposal(repoRoot, {
        action: 'create',
        path: '.github/copilot-instructions.md',
        content: '## Testing\n\n- Update tests.\n',
        reason: 'test',
      });
      const content = await readGlobalInstructions(repoRoot);
      expect(content).toContain('Update tests');
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('deletes a file for a delete proposal', async () => {
    const repoRoot = await createTempRepo();
    const path = join(repoRoot, '.github', 'copilot-instructions.md');
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(path, '## Test\n');
      await applyProposal(repoRoot, {
        action: 'delete',
        path: '.github/copilot-instructions.md',
        reason: 'test',
      });
      await expect(access(path)).rejects.toThrow();
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });
});

describe('isSafePath', () => {
  it('allows valid .github paths', () => {
    expect(isSafePath('.github/copilot-instructions.md')).toBe(true);
    expect(isSafePath('.github/instructions/testing.instructions.md')).toBe(true);
    expect(isSafePath('.github/skills/my-skill/SKILL.md')).toBe(true);
    expect(isSafePath('.github/prompts/deploy.prompt.md')).toBe(true);
  });

  it('rejects path traversal', () => {
    expect(isSafePath('../etc/passwd')).toBe(false);
    expect(isSafePath('.github/../../../etc/passwd')).toBe(false);
    expect(isSafePath('.github/copilot-instructions.md/../../../etc/passwd')).toBe(false);
  });

  it('rejects null bytes', () => {
    expect(isSafePath('.github/copilot-instructions.md\0')).toBe(false);
  });

  it('rejects paths outside allowed prefixes', () => {
    expect(isSafePath('README.md')).toBe(false);
    expect(isSafePath('.github/workflows/ci.yml')).toBe(false);
    expect(isSafePath('/etc/passwd')).toBe(false);
  });
});
