import type { SemanticClassifier, SemanticClassifierRequest } from './hybrid.js';

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

/**
 * Optional OpenAI-compatible semantic classifier.
 *
 * Activated only when INSTRUCTION_ARCHITECT_LLM_API_KEY is set.
 */
export function createSemanticClassifierFromEnv(): SemanticClassifier | undefined {
  const apiKey = process.env.INSTRUCTION_ARCHITECT_LLM_API_KEY;
  if (!apiKey) return undefined;
  const baseUrl = process.env.INSTRUCTION_ARCHITECT_LLM_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.INSTRUCTION_ARCHITECT_LLM_MODEL ?? 'gpt-4o-mini';
  return new OpenAICompatibleSemanticClassifier(baseUrl, apiKey, model);
}

class OpenAICompatibleSemanticClassifier implements SemanticClassifier {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async classify(request: SemanticClassifierRequest): Promise<unknown> {
    const prompt = buildPrompt(request);
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
              'You are a semantic classifier for repository AI knowledge. Return JSON only. Classify with minimal context cost and preserve intent.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM classify request failed (${res.status})`);
    const json = (await res.json()) as OpenAIChatResponse;
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM classify response was empty');
    return JSON.parse(content);
  }
}

function buildPrompt(request: SemanticClassifierRequest): string {
  return JSON.stringify(
    {
      task: 'Classify candidate repository knowledge with minimal context cost.',
      schema: {
        classification:
          'NONE | GLOBAL_INSTRUCTION | PATH_INSTRUCTION | SKILL | PROMPT | AGENT | DOCUMENTATION_ONLY',
        confidence: 'number from 0 to 1',
        reason: 'string',
        scope: 'string',
        value: 'string',
        contextCost: 'string',
        maintenanceCost: 'string',
        evidence: ['string'],
        alternatives: [
          'NONE | GLOBAL_INSTRUCTION | PATH_INSTRUCTION | SKILL | PROMPT | AGENT | DOCUMENTATION_ONLY',
        ],
      },
      candidateRule: request.candidate,
      deterministicEvidence: request.evidence,
      relatedItems: request.relatedItems,
      instructions: [
        'Treat duplicate/overlap/contradiction/discoverable signals as evidence, not automatic truth.',
        'Decide what the repository should remember and how it should be represented based on the full evidence.',
        'Prefer NONE if discoverable and not behaviourally valuable.',
        'Distinguish facts from durable behavioural guidance.',
        'Use PATH_INSTRUCTION only when file/path scoping is justified.',
        'Use AGENT only when a distinct autonomous role is clearly justified.',
      ],
    },
    null,
    2
  );
}
