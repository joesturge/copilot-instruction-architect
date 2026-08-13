import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { KnowledgeItem } from '../classifier/types.js';

/**
 * Write the global copilot instructions file.
 *
 * If the file already exists, the baseline section is updated while
 * repository-specific content is preserved.
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

/**
 * Write a path-specific instructions file with an `applyTo` front-matter.
 */
export async function writePathInstruction(
  repoRoot: string,
  name: string,
  pathGlob: string,
  content: string
): Promise<void> {
  const path = join(repoRoot, '.github', 'instructions', `${name}.instructions.md`);
  await mkdir(dirname(path), { recursive: true });
  const withFrontMatter = `---\napplyTo: '${pathGlob}'\n---\n\n${content}`;
  await writeFile(path, withFrontMatter, 'utf8');
}

/**
 * Write a skill SKILL.md file.
 */
export async function writeSkill(
  repoRoot: string,
  skillName: string,
  content: string
): Promise<void> {
  const path = join(repoRoot, '.github', 'skills', skillName, 'SKILL.md');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

/**
 * Write a prompt file.
 */
export async function writePrompt(
  repoRoot: string,
  promptName: string,
  content: string
): Promise<void> {
  const path = join(repoRoot, '.github', 'prompts', `${promptName}.prompt.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

/**
 * Format a list of knowledge items as a markdown instruction section.
 */
export function formatInstructions(
  heading: string,
  items: KnowledgeItem[]
): string {
  const lines = items.map((i) => `- ${i.content}`).join('\n');
  return `## ${heading}\n\n${lines}\n`;
}
