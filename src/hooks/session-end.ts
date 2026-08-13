/**
 * Session end hook — analyse accumulated observations and summarise findings.
 *
 * Defers expensive analysis until the session is complete to avoid
 * interrupting development flow.
 */
import { loadState } from '../state/state.js';

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

  console.log('\nInstruction Architect — Session observations:\n');
  for (const obs of highConfidence) {
    console.log(`  [${obs.type}] ${obs.description} (confidence: ${obs.confidence})`);
  }
  console.log('\nRun `instruction-architect improve` to review proposals.\n');
}

main().catch(() => {
  // Hooks must never crash the session.
});
