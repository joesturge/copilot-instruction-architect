import { describe, it, expect } from 'vitest';
import { redactObservation } from '../src/state/state.js';

describe('redactObservation', () => {
  it('redacts API keys from descriptions', () => {
    const obs = {
      timestamp: new Date().toISOString(),
      type: 'correction' as const,
      description: 'The user set api_key=supersecretvalue123 in the config.',
      confidence: 'high' as const,
      repoRoot: '/repo',
    };
    const redacted = redactObservation(obs);
    expect(redacted.description).not.toContain('supersecretvalue123');
    expect(redacted.description).toContain('[REDACTED]');
  });

  it('preserves non-sensitive descriptions', () => {
    const obs = {
      timestamp: new Date().toISOString(),
      type: 'correction' as const,
      description: 'Generated files should not be edited directly.',
      confidence: 'high' as const,
      repoRoot: '/repo',
    };
    const redacted = redactObservation(obs);
    expect(redacted.description).toBe(obs.description);
  });
});
