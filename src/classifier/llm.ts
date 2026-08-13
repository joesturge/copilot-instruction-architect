import type { FileProposal, RepositoryProposal, ProposalAction } from './types.js';
import type { ConversationObservation } from '../knowledge/pipeline.js';

const VALID_ACTIONS: ProposalAction[] = ['create', 'update', 'delete'];

/**
 * Allowed path prefixes for LLM proposals.
 * Prevents proposals from touching arbitrary repository paths.
 */
const ALLOWED_PATH_PREFIXES = [
  '.github/copilot-instructions.md',
  '.github/instructions/',
  '.github/skills/',
  '.github/prompts/',
  '.github/agents/',
];

export interface ReasoningContext {
  existingFiles: Array<{ path: string; content: string }>;
  observations?: ConversationObservation[];
}

export interface LLMReasoner {
  propose(context: ReasoningContext): Promise<RepositoryProposal>;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

/**
 * Create an LLM reasoner from environment variables, or return undefined
 * when no API key is configured.
 */
export function createLLMReasonerFromEnv(): LLMReasoner | undefined {
  const apiKey = process.env.INSTRUCTION_ARCHITECT_LLM_API_KEY;
  if (!apiKey) return undefined;
  const baseUrl = process.env.INSTRUCTION_ARCHITECT_LLM_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.INSTRUCTION_ARCHITECT_LLM_MODEL ?? 'gpt-4o-mini';
  return new OpenAICompatibleReasoner(baseUrl, apiKey, model);
}

class OpenAICompatibleReasoner implements LLMReasoner {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async propose(context: ReasoningContext): Promise<RepositoryProposal> {
    const prompt = buildPrompt(context);
    const authHeader = ['Bearer', this.apiKey].join(' ');
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are an AI configuration architect for GitHub Copilot. Return JSON only. Propose file changes that improve Copilot configuration for this repository.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM request failed (${res.status})`);
    const json = (await res.json()) as OpenAIChatResponse;
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM response was empty');
    return validateProposal(JSON.parse(content));
  }
}

function buildPrompt(context: ReasoningContext): string {
  return JSON.stringify(
    {
      task: 'Propose changes to GitHub Copilot AI configuration files for this repository.',
      schema: {
        proposals: [
          {
            action: 'create | update | delete',
            path: 'relative path (must start with .github/)',
            content: 'file content for create/update actions',
            applyTo: 'glob pattern for .github/instructions files (optional)',
            reason: 'why this change is needed',
          },
        ],
        summary: 'brief summary of proposed changes',
      },
      existingFiles: context.existingFiles,
      conversationObservations: context.observations ?? [],
      instructions: [
        'Read the existing configuration files and conversation observations carefully.',
        'Decide what knowledge is worth persisting and in which Copilot mechanism.',
        'Preserve existing repository-specific guidance unless it is clearly wrong or duplicated.',
        'Prefer no instruction (omit) when a fact is discoverable from repository files.',
        'Use .github/copilot-instructions.md for repository-wide behavioural guidance.',
        'Use .github/instructions/<name>.instructions.md with applyTo for file-scoped guidance.',
        'Use .github/skills/<name>/SKILL.md for on-demand multi-step workflows.',
        'Use .github/prompts/<name>.prompt.md for explicitly user-invoked operations.',
        'All proposal paths must start with .github/.',
        'Return an empty proposals array if no changes are needed.',
      ],
    },
    null,
    2
  );
}

/**
 * Validate and sanitise the raw LLM response.
 * Returns a safe proposal with only structurally valid, path-safe entries.
 */
export function validateProposal(raw: unknown): RepositoryProposal {
  if (!raw || typeof raw !== 'object') {
    return { proposals: [], summary: 'Invalid LLM response structure.' };
  }
  const r = raw as Partial<RepositoryProposal>;
  const summary = typeof r.summary === 'string' ? r.summary : '';
  const proposals: FileProposal[] = [];
  if (Array.isArray(r.proposals)) {
    for (const p of r.proposals) {
      const validated = validateFileProposal(p);
      if (validated) proposals.push(validated);
    }
  }
  return { proposals, summary };
}

function validateFileProposal(raw: unknown): FileProposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<FileProposal>;
  if (!p.action || !VALID_ACTIONS.includes(p.action)) return null;
  if (typeof p.path !== 'string' || !isSafePath(p.path)) return null;
  if (p.action !== 'delete' && typeof p.content !== 'string') return null;
  return {
    action: p.action,
    path: p.path,
    content: p.content,
    applyTo: typeof p.applyTo === 'string' ? p.applyTo : undefined,
    reason: typeof p.reason === 'string' ? p.reason : '',
  };
}

/**
 * Reject paths containing traversal sequences or outside allowed prefixes.
 */
function isSafePath(path: string): boolean {
  if (path.includes('..') || path.includes('\0')) return false;
  return ALLOWED_PATH_PREFIXES.some(
    (prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix)
  );
}
