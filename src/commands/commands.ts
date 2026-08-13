import { getBaseline } from '../baseline/baseline.js';
import { readExistingConfig } from '../analyser/analyser.js';

/**
 * seed — prepare the current Copilot session to seed or restructure the
 * repository's AI configuration.
 */
export async function seed(repoRoot: string): Promise<string> {
  const baseline = getBaseline();
  const existingFiles = await readExistingConfig(repoRoot);
  const lines: string[] = ['# Instruction Architect — Seed\n'];

  lines.push('Instruction Architect uses the current Copilot session for reasoning.');
  lines.push('No separate LLM API, model, or second context window is used.\n');
  lines.push(`Baseline version: ${baseline.version}\n`);
  appendExistingFiles(lines, existingFiles);
  lines.push('In the current Copilot conversation:');
  lines.push('1. Review the existing AI configuration files and any relevant repository documentation.');
  lines.push('2. Use the baseline as reference guidance, not something to copy wholesale.');
  lines.push('3. Decide whether any durable guidance is worth persisting.');
  lines.push('4. Choose the smallest useful representation: global instructions, applyTo-scoped instructions, a skill, a prompt, an agent, documentation, or no change.');
  lines.push('5. Preserve valid repository-specific guidance and avoid discoverable, duplicated, or transient content.');

  return lines.join('\n');
}

/**
 * improve — prepare the current Copilot session to review existing
 * configuration and propose the smallest useful improvement.
 */
export async function improve(repoRoot: string): Promise<string> {
  const existingFiles = await readExistingConfig(repoRoot);
  const lines: string[] = ['# Instruction Architect — Improvement Proposals\n'];

  lines.push('Instruction Architect does not run a separate LLM for improvement analysis.');
  lines.push('Use the active Copilot conversation, current repository context, and the instruction-architect skill.\n');
  appendExistingFiles(lines, existingFiles);

  lines.push('Review the current configuration and decide whether to:');
  lines.push('- remove duplicated, contradictory, stale, or discoverable content');
  lines.push('- move guidance into a better representation or scope');
  lines.push('- add missing durable guidance only when it will help future work');
  lines.push('- leave the repository unchanged when no meaningful improvement is needed');

  return lines.join('\n');
}

/**
 * review — list existing AI configuration files.
 */
export async function review(repoRoot: string): Promise<string> {
  const existingFiles = await readExistingConfig(repoRoot);
  const lines: string[] = ['# Instruction Architect — Configuration Review\n'];

  lines.push(`## Existing files (${existingFiles.length})`);
  for (const f of existingFiles) lines.push(`- ${f.path}`);
  lines.push('');

  return lines.join('\n');
}

function appendExistingFiles(
  lines: string[],
  existingFiles: Array<{ path: string; content: string }>
): void {
  if (existingFiles.length === 0) {
    lines.push('Existing AI configuration files: none found.\n');
    return;
  }

  lines.push(`Existing AI configuration files (${existingFiles.length}):`);
  for (const file of existingFiles) lines.push(`- ${file.path}`);
  lines.push('');
}
