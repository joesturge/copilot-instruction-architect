/**
 * Session end hook — analyse accumulated observations and summarise findings.
 *
 * Defers expensive analysis until the session is complete to avoid
 * interrupting development flow.
 */
import { loadState } from '../state/state.js';
import { createSemanticClassifierFromEnv } from '../classifier/llm.js';
import { evaluateConversationKnowledge, groupRepresentationDecisions } from '../knowledge/pipeline.js';

async function main(): Promise<void> {
  const state = await loadState();
  if (state.preferences.autonomy === 'disabled') return;

  if (state.observations.length === 0) return;

  const semanticClassifier = createSemanticClassifierFromEnv();
  const latest = [...state.observations].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  const repoRoot = latest?.repoRoot;
  if (!repoRoot) return;
  const repoObservations = state.observations.filter((o) => o.repoRoot === repoRoot);

  const evaluated = await evaluateConversationKnowledge(repoRoot, repoObservations, {
    semanticClassifier,
  });
  if (evaluated.decisions.length === 0) return;
  const grouped = groupRepresentationDecisions(evaluated.decisions);
  const kept = evaluated.decisions.filter((decision) => decision.shouldPersist);

  console.log('\nInstruction Architect — Session knowledge proposals:\n');
  for (const decision of kept.slice(0, 12)) {
    console.log(`  [${decision.semantic.classification}] ${decision.item.content}`);
  }
  console.log('');
  console.log(`  Keep: ${kept.length}`);
  console.log(`  Drop: ${grouped.dropped.length}`);
  if (grouped.path.size > 0) console.log(`  Path-scoped groups: ${grouped.path.size}`);
  if (grouped.skills.length > 0) console.log(`  Skill candidates: ${grouped.skills.length}`);
  if (grouped.prompts.length > 0) console.log(`  Prompt candidates: ${grouped.prompts.length}`);
  if (grouped.global.length > 0) console.log(`  Global candidates: ${grouped.global.length}`);

  if (kept.length > 0) {
    console.log('\nRun `instruction-architect seed` to migrate accepted knowledge into repository AI files.');
  } else {
    console.log('\nNo persistent repository knowledge changes proposed.');
  }
}

main().catch(() => {
  // Hooks must never crash the session.
});
