/**
 * Session end hook — analyse accumulated observations and persist learning.
 *
 * When an LLM is configured, runs the full pipeline:
 *   context gathering → LLM reasoning → structured proposal → apply
 *
 * When no LLM is configured, falls back to a mechanical append of
 * observations directly to copilot-instructions.md so that conversation
 * learning still works without requiring API credentials.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadState } from '../state/state.js';
import { createLLMReasonerFromEnv } from '../classifier/llm.js';
import { proposeRepositoryChanges } from '../knowledge/pipeline.js';
import type { ConversationObservation } from '../knowledge/pipeline.js';
import { applyProposal } from '../commands/commands.js';
import { readGlobalInstructions } from '../io/writer.js';

async function main(): Promise<void> {
  const state = await loadState();
  if (state.preferences.autonomy === 'disabled') return;

  const recentObservations = state.observations.filter((o) => {
    const age = Date.now() - new Date(o.timestamp).getTime();
    return age < 24 * 60 * 60 * 1000; // last 24 hours
  });
  if (recentObservations.length === 0) return;

  const latest = [...recentObservations].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  const repoRoot = latest?.repoRoot;
  if (!repoRoot) return;

  const repoObservations: ConversationObservation[] = recentObservations
    .filter((o) => o.repoRoot === repoRoot);

  const llm = createLLMReasonerFromEnv();

  if (llm) {
    // Full pipeline: context → LLM → structured proposal → apply.
    const { proposals, summary } = await proposeRepositoryChanges(repoRoot, {
      llm,
      observations: repoObservations,
    });
    if (proposals.length === 0) return;

    if (state.preferences.autonomy === 'automatic') {
      for (const proposal of proposals) {
        await applyProposal(repoRoot, proposal);
      }
      console.log('\nInstruction Architect — Session knowledge applied:\n');
      for (const proposal of proposals) {
        console.log(`  ✓ ${proposal.path}`);
      }
    } else {
      console.log('\nInstruction Architect — Session knowledge proposals:\n');
      for (const proposal of proposals) {
        console.log(`  [${proposal.action}] ${proposal.path}: ${proposal.reason}`);
      }
      if (summary) console.log(`\n  ${summary}`);
      console.log('\nSet `instruction-architect configure autonomy automatic` to apply these proposals at session end.');
    }
    return;
  }

  // No LLM: mechanical fallback — append observations directly.
  // The LLM would decide what to keep and where; without it, write everything.
  if (state.preferences.autonomy !== 'automatic') {
    console.log('\nInstruction Architect — Session knowledge proposals:\n');
    for (const obs of repoObservations.slice(0, 12)) {
      console.log(`  [observation] ${obs.description}`);
    }
    console.log('\nSet INSTRUCTION_ARCHITECT_LLM_API_KEY for LLM reasoning, or set autonomy to automatic to apply directly.');
    return;
  }

  const existing = await readGlobalInstructions(repoRoot);
  const existingBullets = new Set(
    existing.split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2).trim())
  );
  const unique = repoObservations
    .map((o) => o.description)
    .filter((desc) => !existingBullets.has(desc.trim()));
  if (unique.length === 0) return;

  const section = `\n## Conversation-learned guidance\n\n${unique.map((d) => `- ${d}`).join('\n')}\n`;
  const updated = existing.trimEnd() ? `${existing.trimEnd()}\n${section}` : section;
  const path = join(repoRoot, '.github', 'copilot-instructions.md');
  await mkdir(join(repoRoot, '.github'), { recursive: true });
  await writeFile(path, updated, 'utf8');
  console.log('\nInstruction Architect — Session knowledge applied:\n');
  console.log(`  ✓ .github/copilot-instructions.md`);
}

main().catch(() => {
  // Hooks must never crash the session.
});

