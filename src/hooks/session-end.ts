/**
 * Session end hook — process accumulated observations through the LLM and
 * persist any durable learning as AI configuration changes.
 *
 * Flow: observations → LLM → structured proposal → mechanical validation → apply
 *
 * When no LLM is configured:
 *   - suggest/review mode: prints observations for manual consideration
 *   - automatic mode: reports that LLM is required and does nothing
 *   Raw observations are NEVER written directly to Copilot instructions.
 *   Without LLM reasoning we cannot determine what is durable, relevant,
 *   or appropriate for persistent configuration.
 */
import { loadState } from '../state/state.js';
import { createLLMReasonerFromEnv } from '../reasoner/llm.js';
import { proposeRepositoryChanges } from '../knowledge/pipeline.js';
import type { ConversationObservation } from '../knowledge/pipeline.js';
import { applyProposal } from '../commands/commands.js';

async function main(): Promise<void> {
  const state = await loadState();
  if (state.preferences.autonomy === 'disabled') return;

  const recentObservations = state.observations.filter((o) => {
    const age = Date.now() - new Date(o.timestamp).getTime();
    return age < 24 * 60 * 60 * 1000; // last 24 hours
  });
  if (recentObservations.length === 0) return;

  // Identify the most recent repository. Only process observations for that
  // repository — never mix observations across different repositories.
  const latest = [...recentObservations].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  const repoRoot = latest?.repoRoot;
  if (!repoRoot) return;

  const repoObservations: ConversationObservation[] = recentObservations.filter(
    (o) => o.repoRoot === repoRoot
  );

  const llm = createLLMReasonerFromEnv();
  const preferences = {
    language: state.preferences.language,
    style: state.preferences.style,
  };

  if (llm) {
    // Full pipeline: context → LLM → structured proposal → apply.
    const { proposals, summary } = await proposeRepositoryChanges(repoRoot, {
      llm,
      observations: repoObservations,
      preferences,
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
      console.log('\nRun `instruction-architect configure autonomy automatic` to apply these proposals automatically.');
    }
    return;
  }

  // No LLM configured.
  if (state.preferences.autonomy === 'automatic') {
    // Cannot safely determine what to persist without LLM reasoning.
    console.log('\nInstruction Architect — Session learning skipped:\n');
    console.log('  LLM reasoning is required to safely determine what knowledge is worth persisting.');
    console.log('  Set INSTRUCTION_ARCHITECT_LLM_API_KEY to enable session learning.');
    return;
  }

  // suggest/review mode: show observations for manual consideration only.
  console.log('\nInstruction Architect — Observations from this session:\n');
  for (const obs of repoObservations.slice(0, 12)) {
    console.log(`  [${obs.type}] ${obs.description}`);
  }
  console.log('\nSet INSTRUCTION_ARCHITECT_LLM_API_KEY to enable automatic reasoning and learning.');
}

main().catch(() => {
  // Hooks must never crash the session.
});
