import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyseRepository } from '../analyser/analyser.js';
import type { RepositoryProposal } from '../classifier/types.js';
import { validateProposal } from '../classifier/llm.js';
import type { LLMReasoner, ReasoningContext } from '../classifier/llm.js';

export interface ConversationObservation {
  description: string;
  confidence: 'high' | 'medium' | 'low';
  type:
    | 'correction'
    | 'repeated_failure'
    | 'repeated_workflow'
    | 'missing_guidance'
    | 'documentation_opportunity'
    | 'testing_opportunity'
    | 'security_issue';
  timestamp: string;
  repoRoot: string;
}

/**
 * Gather repository and conversation context, then request an LLM reasoning
 * pass to produce a structured change proposal.
 *
 * Returns an empty proposal when no LLM is configured.
 */
export async function proposeRepositoryChanges(
  repoRoot: string,
  options: { llm?: LLMReasoner; observations?: ConversationObservation[] } = {}
): Promise<RepositoryProposal> {
  const { existingFiles, profile } = await analyseRepository(repoRoot);

  if (!options.llm) {
    return { proposals: [], summary: 'No LLM configured. Set INSTRUCTION_ARCHITECT_LLM_API_KEY to enable reasoning.' };
  }

  const fileContents = await readExistingFileContents(repoRoot, existingFiles);
  const context: ReasoningContext = {
    existingFiles: fileContents,
    profile,
    observations: options.observations,
  };

  return options.llm.propose(context)
    .then(validateProposal)
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Instruction Architect: LLM reasoning failed — ${message}`);
    return {
      proposals: [],
      summary: 'LLM reasoning failed.',
    };
  });
}

async function readExistingFileContents(
  repoRoot: string,
  paths: string[]
): Promise<Array<{ path: string; content: string }>> {
  const results: Array<{ path: string; content: string }> = [];
  for (const path of paths) {
    const content = await readFile(join(repoRoot, path), 'utf8').catch(() => null);
    if (content !== null) results.push({ path, content });
  }
  return results;
}

