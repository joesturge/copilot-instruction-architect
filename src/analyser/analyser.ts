import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';

/**
 * Source files that may contain existing AI configuration.
 */
const SOURCE_FILES = [
  '.github/copilot-instructions.md',
  'AGENTS.md',
  'CLAUDE.md',
  '.cursor/rules',
];

const SOURCE_DIRS = [
  '.github/instructions',
  '.github/skills',
  '.github/prompts',
  '.github/agents',
];

/**
 * Recursively find all markdown files in a directory.
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const s = await stat(full).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) {
      files.push(...(await findMarkdownFiles(full)));
    } else if (extname(entry) === '.md') {
      files.push(full);
    }
  }
  return files;
}

/**
 * Read all existing AI configuration files from the repository.
 * Returns their paths and contents so the LLM can reason about them.
 */
export async function readExistingConfig(
  repoRoot: string
): Promise<Array<{ path: string; content: string }>> {
  const results: Array<{ path: string; content: string }> = [];

  for (const rel of SOURCE_FILES) {
    const content = await readFile(join(repoRoot, rel), 'utf8').catch(() => null);
    if (content !== null) results.push({ path: rel, content });
  }

  for (const rel of SOURCE_DIRS) {
    const files = await findMarkdownFiles(join(repoRoot, rel));
    for (const file of files) {
      const content = await readFile(file, 'utf8').catch(() => null);
      if (content !== null) results.push({ path: relative(repoRoot, file), content });
    }
  }

  return results;
}
