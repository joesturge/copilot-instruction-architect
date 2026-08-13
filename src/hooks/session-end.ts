/**
 * Session end hook — surface lightweight reminders from stored observations.
 *
 * Semantic reasoning remains in the active Copilot session. The hook does not
 * invoke another model or apply repository changes automatically.
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

  // Identify the most recent repository. Only process observations for that
  // repository — never mix observations across different repositories.
  const latest = [...recentObservations].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  const repoRoot = latest?.repoRoot;
  if (!repoRoot) return;

  const repoObservations = recentObservations.filter(
    (o) => o.repoRoot === repoRoot
  );

  console.log('\nInstruction Architect — Session reminder:\n');
  for (const obs of repoObservations.slice(0, 12)) {
    console.log(`  [${obs.type}] ${obs.description}`);
  }
  console.log('\nUse the current Copilot conversation and the instruction-architect skill to decide whether any of this belongs in instructions, skills, prompts, agents, documentation, or nowhere.');
  console.log('Raw observations are never persisted automatically.');
}

main().catch(() => {
  // Hooks must never crash the session.
});
