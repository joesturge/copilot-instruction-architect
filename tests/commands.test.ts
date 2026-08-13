import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { seed, audit } from '../src/commands/commands.js';
import { readGlobalInstructions } from '../src/io/writer.js';

async function createTempRepo(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ia-test-'));
}

describe('seed', () => {
  it('creates copilot-instructions.md in an empty repository', async () => {
    const repoRoot = await createTempRepo();
    try {
      const output = await seed(repoRoot);
      expect(output).toContain('copilot-instructions.md');
      const content = await readGlobalInstructions(repoRoot);
      expect(content).toContain('Documentation');
      expect(content).toContain('Testing');
      expect(content).toContain('Security');
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('is idempotent — re-running does not cause churn', async () => {
    const repoRoot = await createTempRepo();
    try {
      await seed(repoRoot);
      const firstRun = await readGlobalInstructions(repoRoot);
      await seed(repoRoot);
      const secondRun = await readGlobalInstructions(repoRoot);
      expect(firstRun).toBe(secondRun);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('migrates existing copilot-instructions.md', async () => {
    const repoRoot = await createTempRepo();
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(
        join(repoRoot, '.github', 'copilot-instructions.md'),
        '## Documentation\n\n- Document meaningful changes.\n'
      );
      const output = await seed(repoRoot);
      expect(output).toContain('copilot-instructions.md');
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('processes existing AGENTS.md', async () => {
    const repoRoot = await createTempRepo();
    try {
      await writeFile(
        join(repoRoot, 'AGENTS.md'),
        '## Testing\n\n- Always update tests when changing behaviour.\n- Use pnpm to install packages.\n'
      );
      await seed(repoRoot);
      const content = await readGlobalInstructions(repoRoot);
      expect(content).toBeDefined();
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });
});

describe('audit', () => {
  it('returns empty findings for a clean repository', async () => {
    const repoRoot = await createTempRepo();
    try {
      const result = await audit(repoRoot);
      expect(result.findings).toHaveLength(0);
      expect(result.existingFiles).toHaveLength(0);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('detects duplicates in existing configuration', async () => {
    const repoRoot = await createTempRepo();
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(
        join(repoRoot, '.github', 'copilot-instructions.md'),
        '## Rules\n\n- Always update tests when changing behaviour.\n- Always update tests when changing behaviour.\n'
      );
      const result = await audit(repoRoot);
      const duplicates = result.findings.filter((f) => f.type === 'duplicate');
      expect(duplicates.length).toBeGreaterThan(0);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('detects discoverable facts', async () => {
    const repoRoot = await createTempRepo();
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(
        join(repoRoot, '.github', 'copilot-instructions.md'),
        '## Setup\n\n- The project uses pnpm.\n- Use npm to install packages.\n'
      );
      const result = await audit(repoRoot);
      const discoverable = result.findings.filter((f) => f.type === 'discoverable');
      expect(discoverable.length).toBeGreaterThan(0);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });
});
