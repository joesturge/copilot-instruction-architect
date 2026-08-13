import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createLLMReasonerFromEnv, validateProposal } from '../reasoner/llm.js';
import { getBaseline } from '../baseline/baseline.js';
import {
  writeGlobalInstructions,
} from '../io/writer.js';
import type { FileProposal } from '../reasoner/types.js';
import { proposeRepositoryChanges } from '../knowledge/pipeline.js';
import { readExistingConfig } from '../analyser/analyser.js';
import { loadState } from '../state/state.js';

/**
 * seed — bootstrap, migrate, and normalise AI configuration.
 *
 * For an empty repository: writes the baseline directly (no LLM needed).
 *
 * For a repository with existing configuration: passes the existing files
 * AND the baseline (as a reference) to the LLM, then applies the resulting
 * validated proposal. Existing repository-specific knowledge is preserved —
 * the LLM decides how to combine, reorganise or deduplicate content.
 */
export async function seed(repoRoot: string): Promise<string> {
  const llm = createLLMReasonerFromEnv();
  const baseline = getBaseline();
  const state = await loadState();
  const existing = await readExistingConfig(repoRoot);
  const lines: string[] = ['# Instruction Architect — Seed\n'];

  if (existing.length === 0) {
    // Empty repository — write the baseline directly; no LLM needed.
    await writeGlobalInstructions(repoRoot, baseline.globalInstructions);
    lines.push('✓ Wrote .github/copilot-instructions.md (baseline)');
    if (!llm) {
      lines.push('');
      lines.push('Tip: Set INSTRUCTION_ARCHITECT_LLM_API_KEY to allow the LLM to review and improve configuration.');
    }
    return lines.join('\n');
  }

  // Repository has existing configuration.
  if (!llm) {
    const hasGlobalInstructions = existing.some(
      (f) => f.path === '.github/copilot-instructions.md'
    );
    if (!hasGlobalInstructions) {
      // No global instructions file yet — safe to write the baseline.
      await writeGlobalInstructions(repoRoot, baseline.globalInstructions);
      lines.push('✓ Wrote .github/copilot-instructions.md (baseline)');
      lines.push('');
      lines.push('Set INSTRUCTION_ARCHITECT_LLM_API_KEY to let the LLM merge other existing configuration files.');
    } else {
      lines.push('Existing configuration detected.');
      lines.push('Set INSTRUCTION_ARCHITECT_LLM_API_KEY to let the LLM review and improve it.');
    }
    return lines.join('\n');
  }

  // LLM available — include existing files and the baseline as reference context,
  // then let the LLM decide how to combine them. The baseline is passed as a
  // reference file so the LLM knows what standard baseline guidance looks like.
  const existingWithBaseline = [
    ...existing,
    {
      path: '__baseline_reference__ (standard baseline — not a real file)',
      content: baseline.globalInstructions,
    },
  ];

  const { proposals, summary } = await llm
    .propose({
      existingFiles: existingWithBaseline,
      observations: [],
      preferences: { language: state.preferences.language, style: state.preferences.style },
    })
    .then(validateProposal)
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Instruction Architect: LLM reasoning failed — ${message}`);
      return { proposals: [], summary: 'LLM reasoning failed.' };
    });

  if (proposals.length === 0) {
    lines.push(summary || 'No changes needed — configuration is already well-organised.');
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
