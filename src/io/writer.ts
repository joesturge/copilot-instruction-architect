import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

/**
 * Write the global copilot instructions file.
 */
export async function writeGlobalInstructions(
  repoRoot: string,
  content: string
): Promise<void> {
  const path = join(repoRoot, '.github', 'copilot-instructions.md');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

/**
 * Read the global copilot instructions file, returning an empty string if
 * it does not exist.
 */
export async function readGlobalInstructions(repoRoot: string): Promise<string> {
  try {
    return await readFile(join(repoRoot, '.github', 'copilot-instructions.md'), 'utf8');
  } catch {
    return '';
  }
}
