import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createLLMReasonerFromEnv } from '../classifier/llm.js';
import { getBaseline } from '../baseline/baseline.js';
import {
  writeGlobalInstructions,
  readGlobalInstructions,
} from '../io/writer.js';
import type { FileProposal } from '../classifier/types.js';
import { proposeRepositoryChanges } from '../knowledge/pipeline.js';
import { readExistingConfig } from '../analyser/analyser.js';

/**
 * seed — bootstrap, migrate, and normalise AI configuration.
 *
 * Writes the baseline to an empty or non-baseline repository.
 * When an LLM is configured, also applies its proposals for existing content.
 * Idempotent: re-running does not cause churn when configuration is already good.
 */
export async function seed(repoRoot: string): Promise<string> {
  const llm = createLLMReasonerFromEnv();
  const baseline = getBaseline();
  const existing = await readGlobalInstructions(repoRoot);

  const baselineAlreadyPresent =
    existing.includes('## Documentation') &&
    existing.includes('## Testing') &&
    existing.includes('## Security');

  if (!baselineAlreadyPresent) {
    await writeGlobalInstructions(repoRoot, baseline.globalInstructions);
  }

  const lines: string[] = ['# Instruction Architect — Seed\n'];
  lines.push('✓ Wrote .github/copilot-instructions.md');

  const { proposals, summary } = await proposeRepositoryChanges(repoRoot, { llm });
  for (const proposal of proposals) {
    await applyProposal(repoRoot, proposal);
    lines.push(`✓ ${proposal.action} ${proposal.path}`);
  }

  if (summary) {
    lines.push('');
    lines.push(summary);
  }

  return lines.join('\n');
}

/**
 * improve — propose LLM-driven improvements to existing configuration.
 */
export async function improve(repoRoot: string): Promise<string> {
  const llm = createLLMReasonerFromEnv();
  const lines: string[] = ['# Instruction Architect — Improvement Proposals\n'];

  if (!llm) {
    lines.push('Set INSTRUCTION_ARCHITECT_LLM_API_KEY to enable LLM-powered analysis.');
    return lines.join('\n');
  }

  const { proposals, summary } = await proposeRepositoryChanges(repoRoot, { llm });

  if (proposals.length === 0) {
    lines.push(summary || 'No improvements found.');
    return lines.join('\n');
  }

  for (const proposal of proposals) {
    lines.push(`- **${proposal.action}** \`${proposal.path}\`: ${proposal.reason}`);
  }

  if (summary) {
    lines.push('');
    lines.push(summary);
  }

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

/**
 * Apply a single file proposal to the repository.
 * Only writes within the .github/ directory.
 */
export async function applyProposal(repoRoot: string, proposal: FileProposal): Promise<void> {
  const path = join(repoRoot, proposal.path);
  if (proposal.action === 'delete') {
    await unlink(path).catch(() => { /* ignore if not found */ });
    return;
  }
  const content = proposal.content ?? '';
  await mkdir(dirname(path), { recursive: true });
  if (proposal.applyTo) {
    await writeFile(path, `---\napplyTo: '${proposal.applyTo}'\n---\n\n${content}`, 'utf8');
  } else {
    await writeFile(path, content, 'utf8');
  }
}
