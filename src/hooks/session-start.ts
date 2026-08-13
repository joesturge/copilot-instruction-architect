/**
 * Session start hook — lightweight initialisation only.
 * Does not perform expensive repository analysis.
 */
import { loadState } from '../state/state.js';

async function main(): Promise<void> {
  const state = await loadState();
  if (state.preferences.autonomy === 'disabled') return;
  // Session start is intentionally minimal — heavier analysis runs at session end.
}

main().catch(() => {
  // Hooks must never crash the session.
});
