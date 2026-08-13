import { describe, it, expect } from 'vitest';
import {
  classifyHybrid,
  type SemanticClassifier,
  type SemanticClassifierRequest,
} from '../src/classifier/hybrid.js';
import type { KnowledgeItem } from '../src/classifier/types.js';

class StubSemanticClassifier implements SemanticClassifier {
  constructor(private readonly payload: unknown) {}
  async classify(): Promise<unknown> {
    return this.payload;
  }
}

class CapturingSemanticClassifier implements SemanticClassifier {
  request: SemanticClassifierRequest | undefined;
  constructor(private readonly payload: unknown) {}
  async classify(request: SemanticClassifierRequest): Promise<unknown> {
    this.request = request;
    return this.payload;
  }
}

describe('classifyHybrid', () => {
  it('returns structured deterministic fallback when no semantic classifier is available', async () => {
    const result = await classifyHybrid({ content: 'Always update tests when changing behaviour.' });
    expect(result.classification).toBe('GLOBAL_INSTRUCTION');
    expect(result.source).toBe('deterministic');
    expect(result.confidence).toBe(0);
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

  it('keeps valid LLM output even with low confidence values', async () => {
    const semantic = new StubSemanticClassifier({
      classification: 'NONE',
      confidence: 0.12,
      reason: 'Likely discoverable and not behaviourally durable.',
      scope: 'Repository/global by default',
      value: 'Low value to persist.',
      contextCost: 'Unnecessary context if persisted.',
      maintenanceCost: 'Avoid maintenance by omitting.',
      evidence: ['Looks discoverable from repository files.'],
      alternatives: ['GLOBAL_INSTRUCTION', 'PATH_INSTRUCTION'],
    });
    const result = await classifyHybrid(
      { content: 'This repository uses npm.' },
      { semanticClassifier: semantic, allItems: [{ content: 'This repository uses npm.' }] }
    );
    expect(result.source).toBe('llm');
    expect(result.confidence).toBe(0.12);
    expect(result.classification).toBe('NONE');
  });

  it('sends neutral deterministic classification evidence to the LLM path', async () => {
    const semantic = new CapturingSemanticClassifier({
      classification: 'GLOBAL_INSTRUCTION',
      confidence: 0.9,
      reason: 'Durable behavioural rule.',
      scope: 'Repository/global by default',
      value: 'Useful across tasks.',
      contextCost: 'Always loaded context; keep concise.',
      maintenanceCost: 'Moderate maintenance cost.',
      evidence: ['Observed repeated behaviour'],
      alternatives: ['NONE', 'PATH_INSTRUCTION'],
    });
    await classifyHybrid(
      { content: 'Always update tests when changing behaviour.' },
      { semanticClassifier: semantic, allItems: [{ content: 'Always update tests when changing behaviour.' }] }
    );
    expect(semantic.request?.evidence.deterministicClassification.classification).toBe('NONE');
    expect(semantic.request?.evidence.deterministicClassification.confidence).toBe('low');
  });

  it('detects obvious discoverable facts without semantic escalation', async () => {
    const item: KnowledgeItem = { content: 'The project uses pnpm.' };
    const result = await classifyHybrid(item);
    expect(result.classification).toBe('NONE');
    expect(result.source).toBe('deterministic');
  });
});
