import { describe, it, expect } from 'vitest';
import { classifyHybrid, type SemanticClassifier } from '../src/classifier/hybrid.js';
import type { KnowledgeItem } from '../src/classifier/types.js';

class StubSemanticClassifier implements SemanticClassifier {
  constructor(private readonly payload: unknown) {}
  async classify(): Promise<unknown> {
    return this.payload;
  }
}

describe('classifyHybrid', () => {
  it('returns structured deterministic fallback when no semantic classifier is available', async () => {
    const result = await classifyHybrid({ content: 'Always update tests when changing behaviour.' });
    expect(result.classification).toBe('GLOBAL_INSTRUCTION');
    expect(result.source).toBe('deterministic');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('uses semantic classifier result when valid and confident', async () => {
    const semantic = new StubSemanticClassifier({
      classification: 'PATH_INSTRUCTION',
      confidence: 0.88,
      reason: 'Rule is file-scoped to tests.',
      scope: 'tests/**',
      value: 'High value for test-specific behaviour.',
      contextCost: 'Low when path-scoped.',
      maintenanceCost: 'Low.',
      evidence: ['Mentions test files explicitly.'],
      alternatives: ['GLOBAL_INSTRUCTION', 'NONE'],
    });
    const result = await classifyHybrid(
      { content: 'Test files must use shared fixtures.' },
      {
        semanticClassifier: semantic,
        allItems: [{ content: 'Test files must use shared fixtures.' }],
      }
    );
    expect(result.classification).toBe('PATH_INSTRUCTION');
    expect(result.source).toBe('llm');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('falls back when semantic response is invalid', async () => {
    const semantic = new StubSemanticClassifier({ classification: 'NOT_VALID' });
    const result = await classifyHybrid(
      { content: 'Always update tests when changing behaviour.' },
      { semanticClassifier: semantic }
    );
    expect(result.source).toBe('fallback');
    expect(result.classification).toBe('GLOBAL_INSTRUCTION');
  });

  it('detects obvious discoverable facts without semantic escalation', async () => {
    const item: KnowledgeItem = { content: 'The project uses pnpm.' };
    const result = await classifyHybrid(item);
    expect(result.classification).toBe('NONE');
    expect(result.source).toBe('deterministic');
  });
});
