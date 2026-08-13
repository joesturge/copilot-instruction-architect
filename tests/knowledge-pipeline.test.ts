import { describe, it, expect } from 'vitest';
import type { KnowledgeItem, RepositoryProfile } from '../src/classifier/types.js';
import {
  evaluateConversationKnowledge,
  evaluateKnowledgeItems,
  groupRepresentationDecisions,
} from '../src/knowledge/pipeline.js';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PROFILE: RepositoryProfile = {
  lockfiles: [],
  hasCiWorkflow: false,
  ciFiles: [],
  testConfigFiles: [],
  copilotFiles: [],
  sourceOfTruthFiles: [],
};

describe('knowledge pipeline', () => {
  it('drops discoverable facts and keeps behavioural guidance', async () => {
    const items: KnowledgeItem[] = [
      { content: 'The project uses pnpm.' },
      { content: 'Always update tests when changing behaviour.' },
    ];
    const result = await evaluateKnowledgeItems(items, PROFILE);
    expect(result.decisions[0].shouldPersist).toBe(false);
    expect(result.decisions[1].shouldPersist).toBe(true);
  });

  it('keeps duplicate candidates and marks them as duplicate evidence', async () => {
    const items: KnowledgeItem[] = [
      { content: 'Always update tests when changing behaviour.' },
      { content: 'Always update tests when changing behaviour.' },
    ];
    const result = await evaluateKnowledgeItems(items, PROFILE);
    const kept = result.decisions.filter((d) => d.shouldPersist);
    expect(kept).toHaveLength(2);
    expect(result.decisions.some((d) => d.duplicate)).toBe(true);
  });

  it('groups only kept representation decisions', async () => {
    const items: KnowledgeItem[] = [
      { content: 'Always update tests when changing behaviour.' },
      { content: 'The project uses pnpm.' },
      { content: 'All test files must use shared fixtures.' },
    ];
    const result = await evaluateKnowledgeItems(items, PROFILE);
    const grouped = groupRepresentationDecisions(result.decisions);
    expect(grouped.global.length).toBe(1);
    expect(grouped.path.size).toBe(1);
    expect(grouped.dropped.length).toBe(1);
  });

  it('evaluates all conversation observations through the same knowledge pipeline', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-conversation-'));
    try {
      const result = await evaluateConversationKnowledge(
        repoRoot,
        [
          {
            description: 'Do not edit generated files directly; change schema and regenerate.',
            confidence: 'high',
            type: 'correction',
            timestamp: new Date().toISOString(),
            repoRoot,
          },
          {
            description: 'Do not edit generated files directly; change schema and regenerate.',
            confidence: 'high',
            type: 'correction',
            timestamp: new Date().toISOString(),
            repoRoot,
          },
          {
            description: 'maybe rename this variable later',
            confidence: 'low',
            type: 'documentation_opportunity',
            timestamp: new Date().toISOString(),
            repoRoot,
          },
        ]
      );
      expect(result.decisions.length).toBe(2);
      expect(result.decisions.some((d) => d.item.content.includes('Do not edit generated files directly'))).toBe(true);
      expect(result.decisions.some((d) => d.item.content.includes('maybe rename this variable later'))).toBe(true);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('treats repository overlap as evidence instead of an automatic drop', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-conversation-known-'));
    try {
      await mkdir(join(repoRoot, '.github'), { recursive: true });
      await writeFile(
        join(repoRoot, '.github', 'copilot-instructions.md'),
        '## Rules\n\n- Do not edit generated files directly; change schema and regenerate.\n',
        'utf8'
      );

      const result = await evaluateConversationKnowledge(
        repoRoot,
        [
          {
            description: 'Do not edit generated files directly; change schema and regenerate.',
            confidence: 'high',
            type: 'correction',
            timestamp: new Date().toISOString(),
            repoRoot,
          },
          {
            description: 'Do not edit generated files directly; change schema and regenerate.',
            confidence: 'high',
            type: 'correction',
            timestamp: new Date().toISOString(),
            repoRoot,
          },
        ]
      );

      expect(result.decisions.length).toBe(1);
      expect(result.decisions[0].duplicate).toBe(true);
      expect(result.decisions[0].shouldPersist).toBe(true);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });
});
