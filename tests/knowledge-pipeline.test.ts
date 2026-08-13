import { describe, it, expect } from 'vitest';
import {
  proposeRepositoryChanges,
  type ConversationObservation,
} from '../src/knowledge/pipeline.js';
import type { LLMReasoner, ReasoningContext } from '../src/classifier/llm.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('knowledge pipeline', () => {
  it('returns empty proposals when no LLM is configured', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-pipeline-'));
    try {
      const result = await proposeRepositoryChanges(repoRoot);
      expect(result.proposals).toHaveLength(0);
      expect(typeof result.summary).toBe('string');
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('calls the LLM with repository context when configured', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-pipeline-'));
    try {
      let capturedContext: ReasoningContext | undefined;
      const mockLLM: LLMReasoner = {
        async propose(ctx) {
          capturedContext = ctx;
          return { proposals: [], summary: 'ok' };
        },
      };
      await proposeRepositoryChanges(repoRoot, { llm: mockLLM });
      expect(capturedContext).toBeDefined();
      expect(capturedContext?.profile).toBeDefined();
      expect(Array.isArray(capturedContext?.existingFiles)).toBe(true);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('passes conversation observations to the LLM', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-pipeline-'));
    try {
      let capturedContext: ReasoningContext | undefined;
      const mockLLM: LLMReasoner = {
        async propose(ctx) {
          capturedContext = ctx;
          return { proposals: [], summary: 'ok' };
        },
      };
      const observations: ConversationObservation[] = [
        {
          description: 'Do not edit generated files directly; change schema and regenerate.',
          confidence: 'high',
          type: 'correction',
          timestamp: new Date().toISOString(),
          repoRoot,
        },
        {
          description: 'Always run the linter before committing.',
          confidence: 'medium',
          type: 'repeated_workflow',
          timestamp: new Date().toISOString(),
          repoRoot,
        },
      ];
      await proposeRepositoryChanges(repoRoot, { llm: mockLLM, observations });
      expect(capturedContext?.observations).toHaveLength(2);
      expect(capturedContext?.observations?.[0]?.description).toBe(
        'Do not edit generated files directly; change schema and regenerate.'
      );
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('validates LLM proposals — rejects unsafe paths', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-pipeline-'));
    try {
      const mockLLM: LLMReasoner = {
        async propose() {
          return {
            proposals: [
              { action: 'create', path: '../../../etc/passwd', content: 'evil', reason: 'bad' },
              { action: 'create', path: '.github/copilot-instructions.md', content: '# Good', reason: 'ok' },
            ],
            summary: 'test',
          };
        },
      };
      const result = await proposeRepositoryChanges(repoRoot, { llm: mockLLM });
      expect(result.proposals).toHaveLength(1);
      expect(result.proposals[0].path).toBe('.github/copilot-instructions.md');
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('returns empty proposals when LLM throws', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-pipeline-'));
    try {
      const mockLLM: LLMReasoner = {
        async propose() {
          throw new Error('LLM unavailable');
        },
      };
      const result = await proposeRepositoryChanges(repoRoot, { llm: mockLLM });
      expect(result.proposals).toHaveLength(0);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });
});

