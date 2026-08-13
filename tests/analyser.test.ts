import { describe, it, expect } from 'vitest';
import { extractKnowledgeFromMarkdown } from '../src/analyser/analyser.js';

describe('extractKnowledgeFromMarkdown', () => {
  it('extracts lines from markdown', () => {
    const content = `
## Testing

- Always update tests when changing behaviour.
- Do not leave stale tests.

## Security

- Fix security issues discovered during development.
`;
    const items = extractKnowledgeFromMarkdown(content, 'test.md');
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.content.includes('update tests'))).toBe(true);
    expect(items.every((i) => i.sourceFile === 'test.md')).toBe(true);
  });

  it('extracts applyTo glob from front-matter', () => {
    const content = `---
applyTo: '**/*.test.ts'
---

## Testing

- Always update tests.
`;
    const items = extractKnowledgeFromMarkdown(content, 'testing.instructions.md');
    expect(items.every((i) => i.pathGlob === '**/*.test.ts')).toBe(true);
  });

  it('returns empty array for blank content', () => {
    const items = extractKnowledgeFromMarkdown('', 'empty.md');
    expect(items).toHaveLength(0);
  });

  it('filters out very short lines', () => {
    const content = `## Section\n\n- Hi\n- This is a real instruction that should be extracted.`;
    const items = extractKnowledgeFromMarkdown(content, 'test.md');
    expect(items.every((i) => i.content.length > 10)).toBe(true);
  });
});
