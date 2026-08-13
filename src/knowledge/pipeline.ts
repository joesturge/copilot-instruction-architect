import { readExistingConfig } from '../analyser/analyser.js';
import type { RepositoryProposal } from '../reasoner/types.js';
import { validateProposal } from '../reasoner/llm.js';
import type { LLMReasoner, ReasoningContext, UserPreferences } from '../reasoner/llm.js';

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
 * Gather repository context, then request an LLM reasoning pass to produce
 * a structured change proposal.
 *
 * Returns an empty proposal when no LLM is configured.
 */
export async function proposeRepositoryChanges(
  repoRoot: string,
  options: {
    llm?: LLMReasoner;
    observations?: ConversationObservation[];
    preferences?: UserPreferences;
    additionalContextFiles?: Array<{ path: string; content: string }>;
  } = {}
): Promise<RepositoryProposal> {
  if (!options.llm) {
    return { proposals: [], summary: 'No LLM configured. Set INSTRUCTION_ARCHITECT_LLM_API_KEY to enable reasoning.' };
  }

  const existingFiles = await readExistingConfig(repoRoot);
  const context: ReasoningContext = {
    existingFiles: [...existingFiles, ...(options.additionalContextFiles ?? [])],
    observations: options.observations,
    preferences: options.preferences,
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
