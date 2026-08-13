import { describe, it, expect } from 'vitest';
import {
  proposeRepositoryChanges,
  type ConversationObservation,
} from '../src/knowledge/pipeline.js';
import type { LLMReasoner, ReasoningContext } from '../src/reasoner/llm.js';
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
      expect(Array.isArray(capturedContext?.existingFiles)).toBe(true);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('includes additional context files in LLM input when provided', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-pipeline-'));
    try {
      let capturedContext: ReasoningContext | undefined;
      const mockLLM: LLMReasoner = {
        async propose(ctx) {
          capturedContext = ctx;
          return { proposals: [], summary: 'ok' };
        },
      };
      await proposeRepositoryChanges(repoRoot, {
        llm: mockLLM,
        additionalContextFiles: [
          { path: '__baseline_reference__', content: '## Baseline' },
        ],
      });
      expect(
        capturedContext?.existingFiles.some((f) => f.path === '__baseline_reference__')
      ).toBe(true);
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


describe('user preferences', () => {
  it('passes user preferences to the LLM reasoning context', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-pipeline-'));
    try {
      let capturedContext: ReasoningContext | undefined;
      const mockLLM: LLMReasoner = {
        async propose(ctx) {
          capturedContext = ctx;
          return { proposals: [], summary: 'ok' };
        },
      };
      await proposeRepositoryChanges(repoRoot, {
        llm: mockLLM,
        preferences: { language: 'en-GB', style: 'formal' },
      });
      expect(capturedContext?.preferences?.language).toBe('en-GB');
      expect(capturedContext?.preferences?.style).toBe('formal');
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });
});

describe('observation repository isolation', () => {
  it('passes all provided observations to the LLM without filtering (filtering is the caller\'s responsibility)', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-pipeline-'));
    const otherRepo = '/some/other/repo';
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
          description: 'Relevant: always run e2e tests before release.',
          confidence: 'high',
          type: 'repeated_workflow',
          timestamp: new Date().toISOString(),
          repoRoot, // belongs to this repo
        },
        {
          description: 'Unrelated: something from another project.',
          confidence: 'high',
          type: 'correction',
          timestamp: new Date().toISOString(),
          repoRoot: otherRepo, // belongs to a different repo
        },
      ];
      // The caller (session-end) is responsible for filtering by repoRoot before calling.
      // The pipeline passes observations as-is to the LLM; isolation is the caller's duty.
      // This test verifies the pipeline does not mix them in unexpectedly.
      await proposeRepositoryChanges(repoRoot, { llm: mockLLM, observations });
      expect(capturedContext?.observations).toHaveLength(2);
    } finally {
      await rm(repoRoot, { recursive: true });
    }
  });

  it('proposals cannot escape the allowed .github/ paths regardless of LLM output', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'ia-pipeline-'));
    try {
      const mockLLM: LLMReasoner = {
        async propose() {
          return {
            proposals: [
              { action: 'create', path: '/etc/cron.d/evil', content: 'evil', reason: 'escape' },
              { action: 'create', path: 'src/evil.ts', content: 'evil', reason: 'escape' },
              { action: 'create', path: '.github/../.ssh/authorized_keys', content: 'evil', reason: 'traversal' },
              { action: 'create', path: '.github/copilot-instructions.md', content: '# Safe', reason: 'ok' },
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
});
