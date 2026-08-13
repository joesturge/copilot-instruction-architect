/**
 * Session end hook — analyse accumulated observations and summarise findings.
 *
 * Defers expensive analysis until the session is complete to avoid
 * interrupting development flow.
 */
import { loadState } from '../state/state.js';
import { createSemanticClassifierFromEnv } from '../classifier/llm.js';
import { evaluateKnowledgeItems, groupRepresentationDecisions } from '../knowledge/pipeline.js';
import type { KnowledgeItem, RepositoryProfile } from '../classifier/types.js';

async function main(): Promise<void> {
  const state = await loadState();
  if (state.preferences.autonomy === 'disabled') return;

  const recentObservations = state.observations.filter((o) => {
    const age = Date.now() - new Date(o.timestamp).getTime();
    return age < 24 * 60 * 60 * 1000; // last 24 hours
  });

  if (recentObservations.length === 0) return;

  const highConfidence = recentObservations.filter((o) => o.confidence === 'high');
  if (highConfidence.length === 0) return;

  const semanticClassifier = createSemanticClassifierFromEnv();
  const items: KnowledgeItem[] = highConfidence.map((obs, index) => ({
    id: `session-observation:${index}`,
    content: obs.description,
    sourceType: 'external',
    scope: 'unknown',
    stability: obs.type === 'repeated_workflow' ? 'high' : 'medium',
    behaviouralValue: obs.type === 'security_issue' ? 'high' : 'medium',
    discoverability: 'low',
  }));
  const profile: RepositoryProfile = {
    lockfiles: [],
    hasCiWorkflow: false,
    ciFiles: [],
    testConfigFiles: [],
    copilotFiles: [],
    sourceOfTruthFiles: [],
  };
  const evaluated = await evaluateKnowledgeItems(items, profile, {
    semanticClassifier,
  });
  const grouped = groupRepresentationDecisions(evaluated.decisions);

  console.log('\nInstruction Architect — Session knowledge proposals:\n');
  for (const decision of evaluated.decisions) {
    console.log(`  [${decision.semantic.classification}] ${decision.item.content}`);
  }
  console.log('');
  console.log(`  Keep: ${evaluated.decisions.filter((d) => d.shouldPersist).length}`);
  console.log(`  Drop: ${grouped.dropped.length}`);
  if (grouped.path.size > 0) console.log(`  Path-scoped groups: ${grouped.path.size}`);
  if (grouped.skills.length > 0) console.log(`  Skill candidates: ${grouped.skills.length}`);
  if (grouped.prompts.length > 0) console.log(`  Prompt candidates: ${grouped.prompts.length}`);
  if (grouped.global.length > 0) console.log(`  Global candidates: ${grouped.global.length}`);

  if (evaluated.decisions.some((decision) => decision.shouldPersist)) {
    console.log('\nRun `instruction-architect seed` to migrate accepted knowledge into repository AI files.');
  } else {
    console.log('\nNo persistent repository knowledge changes proposed.');
  }
}

main().catch(() => {
  // Hooks must never crash the session.
});
