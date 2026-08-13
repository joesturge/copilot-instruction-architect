import { describe, it, expect } from 'vitest';
import { classify, classifyAll } from '../src/classifier/classifier.js';
import type { KnowledgeItem } from '../src/classifier/types.js';

describe('classify', () => {
  it('returns NONE for empty content', () => {
    const result = classify({ content: '' });
    expect(result.classification).toBe('NONE');
    expect(result.confidence).toBe('high');
  });

  it('returns NONE for discoverable package manager facts', () => {
    const cases = [
      'The project uses pnpm.',
      'Use npm to install packages.',
      'This repo uses yarn.',
      'This repository uses bun.',
    ];
    for (const content of cases) {
      const result = classify({ content });
      expect(result.classification).toBe('NONE');
    }
  });

  it('returns NONE for discoverable language facts', () => {
    const result = classify({ content: 'Written in TypeScript.' });
    expect(result.classification).toBe('NONE');
  });

  it('returns GLOBAL_INSTRUCTION for repository-wide behavioural rules', () => {
    const cases = [
      'Always update tests when changing behaviour.',
      'Never leave stale tests.',
      'Prefer existing repository patterns.',
    ];
    for (const content of cases) {
      const result = classify({ content });
      expect(result.classification).toBe('GLOBAL_INSTRUCTION');
    }
  });

  it('returns PATH_INSTRUCTION for test-scoped guidance', () => {
    const result = classify({ content: 'All test files must use the shared test helpers.' });
    expect(result.classification).toBe('PATH_INSTRUCTION');
    expect(result.suggestedPathGlob).toBeDefined();
  });

  it('returns SKILL for multi-step workflows', () => {
    const result = classify({
      content: 'Run the linter first, then run the tests, then verify the build.',
    });
    expect(result.classification).toBe('SKILL');
  });

  it('returns PROMPT for explicit user operations', () => {
    const result = classify({ content: 'Audit all dependencies for security issues.' });
    expect(result.classification).toBe('PROMPT');
  });

  it('classifyAll returns results in same order', () => {
    const items: KnowledgeItem[] = [
      { content: 'Always update tests when changing behaviour.' },
      { content: 'The project uses pnpm.' },
      { content: 'Run linter then tests then verify.' },
    ];
    const results = classifyAll(items);
    expect(results).toHaveLength(3);
    expect(results[0].classification).toBe('GLOBAL_INSTRUCTION');
    expect(results[1].classification).toBe('NONE');
    expect(results[2].classification).toBe('SKILL');
  });

  it('returns suggested path for global instructions', () => {
    const result = classify({ content: 'Always update tests when changing behaviour.' });
    expect(result.suggestedPath).toBe('.github/copilot-instructions.md');
  });

  it('returns suggested path for skills', () => {
    const result = classify({ content: 'Run linter first, then run tests, then verify build.' });
    expect(result.suggestedPath).toMatch(/\.github\/skills\//);
  });
});
