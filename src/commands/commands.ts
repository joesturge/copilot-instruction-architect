import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createLLMReasonerFromEnv } from '../reasoner/llm.js';
import { getBaseline } from '../baseline/baseline.js';
import type { FileProposal } from '../reasoner/types.js';
import { proposeRepositoryChanges } from '../knowledge/pipeline.js';
import { readExistingConfig } from '../analyser/analyser.js';
import { loadState } from '../state/state.js';

/**
 * seed — bootstrap, migrate, and normalise AI configuration.
 *
 * Passes existing configuration plus the baseline reference through the same
 * LLM reasoning pipeline used for repository improvements, then applies the
 * validated proposal.
 */
export async function seed(repoRoot: string): Promise<string> {
  const llm = createLLMReasonerFromEnv();
  const baseline = getBaseline();
  const state = await loadState();
  const lines: string[] = ['# Instruction Architect — Seed\n'];

  if (!llm) {
    lines.push('LLM reasoning is required for seed to architect baseline guidance into repository configuration.');
    lines.push('Set INSTRUCTION_ARCHITECT_LLM_API_KEY to enable seed.');
    return lines.join('\n');
  }

  const { proposals, summary } = await proposeRepositoryChanges(repoRoot, {
    llm,
    observations: [],
    preferences: { language: state.preferences.language, style: state.preferences.style },
    additionalContextFiles: [
      {
        path: '__baseline_reference__ (standard baseline — not a real file)',
        content: baseline.globalInstructions,
      },
    ],
  });

  if (proposals.length === 0) {
    lines.push(summary || 'No changes needed.');
    return lines.join('\n');
  }

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
  const state = await loadState();
  const lines: string[] = ['# Instruction Architect — Improvement Proposals\n'];

  if (!llm) {
    lines.push('Set INSTRUCTION_ARCHITECT_LLM_API_KEY to enable LLM-powered analysis.');
    return lines.join('\n');
  }

  const { proposals, summary } = await proposeRepositoryChanges(repoRoot, {
    llm,
    preferences: { language: state.preferences.language, style: state.preferences.style },
  });

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
 * Path safety is enforced by isSafePath at proposal validation time.
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
