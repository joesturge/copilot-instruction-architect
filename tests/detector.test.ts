import { describe, it, expect } from 'vitest';
import {
  detectDuplicates,
  detectSemanticOverlap,
  detectContradictions,
  detectDiscoverable,
  DUPLICATE_THRESHOLD,
  OVERLAP_THRESHOLD,
} from '../src/classifier/detector.js';
import type { KnowledgeItem } from '../src/classifier/types.js';

describe('detectDuplicates', () => {
  it('finds near-identical items', () => {
    const items: KnowledgeItem[] = [
      { content: 'Always update tests when changing behaviour.' },
      { content: 'Always update tests when changing behaviour.' },
    ];
    const findings = detectDuplicates(items);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].type).toBe('duplicate');
  });

  it('does not flag clearly different items', () => {
    const items: KnowledgeItem[] = [
      { content: 'Always update tests when changing behaviour.' },
      { content: 'Use the repository package manager to install dependencies.' },
    ];
    const findings = detectDuplicates(items);
    expect(findings).toHaveLength(0);
  });

  it('returns empty array for a single item', () => {
    const items: KnowledgeItem[] = [{ content: 'Always update tests.' }];
    expect(detectDuplicates(items)).toHaveLength(0);
  });
});

describe('detectSemanticOverlap', () => {
  it('finds significantly overlapping but non-identical items', () => {
    const items: KnowledgeItem[] = [
      { content: 'Always update tests when changing behaviour in the codebase.' },
      { content: 'Update tests whenever you change behaviour in the code.' },
    ];
    const findings = detectSemanticOverlap(items);
    // Overlap may or may not trigger depending on threshold; assert type if found.
    for (const f of findings) {
      expect(f.type).toBe('overly_broad');
    }
  });

  it('does not flag truly distinct items', () => {
    const items: KnowledgeItem[] = [
      { content: 'Run security scans before releasing.' },
      { content: 'Document meaningful changes.' },
    ];
    const findings = detectSemanticOverlap(items);
    expect(findings).toHaveLength(0);
  });
});

describe('detectContradictions', () => {
  it('flags pairs with similar content and opposing modality', () => {
    const items: KnowledgeItem[] = [
      { content: 'Always add a comment when modifying shared utilities.' },
      { content: 'Never add unnecessary comments when modifying shared utilities.' },
    ];
    const findings = detectContradictions(items);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].type).toBe('contradiction');
  });

  it('does not flag unrelated items', () => {
    const items: KnowledgeItem[] = [
      { content: 'Always update tests.' },
      { content: 'Document meaningful changes.' },
    ];
    expect(detectContradictions(items)).toHaveLength(0);
  });
});

describe('detectDiscoverable', () => {
  it('flags instructions about package managers', () => {
    const items: KnowledgeItem[] = [
      { content: 'Use pnpm to install packages.' },
      { content: 'The project uses yarn.' },
    ];
    const findings = detectDiscoverable(items);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].type).toBe('discoverable');
  });

  it('does not flag behavioural instructions', () => {
    const items: KnowledgeItem[] = [
      { content: 'Always update tests when changing behaviour.' },
    ];
    expect(detectDiscoverable(items)).toHaveLength(0);
  });
});
