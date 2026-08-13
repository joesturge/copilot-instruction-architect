import { describe, it, expect } from 'vitest';
import { readExistingConfig } from '../src/analyser/analyser.js';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('readExistingConfig', () => {
  it('returns empty array for a repository with no AI config files', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-analyser-'));
    try {
      const files = await readExistingConfig(repoRoot);
      expect(files).toHaveLength(0);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('reads copilot-instructions.md when present', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-analyser-'));
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(
        join(repoRoot, '.github', 'copilot-instructions.md'),
        '## Testing\n\n- Always update tests.\n'
      );
      const files = await readExistingConfig(repoRoot);
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('.github/copilot-instructions.md');
      expect(files[0].content).toContain('Always update tests');
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('reads AGENTS.md when present', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-analyser-'));
    try {
      await writeFile(join(repoRoot, 'AGENTS.md'), '## Guidance\n\n- Use pnpm.\n');
      const files = await readExistingConfig(repoRoot);
      expect(files.some((f) => f.path === 'AGENTS.md')).toBe(true);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('reads files from .github/instructions directory', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-analyser-'));
    try {
      await mkdir(join(repoRoot, '.github', 'instructions'), { recursive: true });
      await writeFile(
        join(repoRoot, '.github', 'instructions', 'testing.instructions.md'),
        "---\napplyTo: '**/*.test.ts'\n---\n\n- Always update tests.\n"
      );
      const files = await readExistingConfig(repoRoot);
      expect(files.some((f) => f.path.includes('testing.instructions.md'))).toBe(true);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });
});
