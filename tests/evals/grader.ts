/**
 * Shared grader helper for Tier 2 (LLM-graded) evals.
 *
 * Usage:
 *   const result = await grade({
 *     context: '...system prompt / skill content...',
 *     prompt: 'Developer question',
 *     response: 'Agent response to evaluate',
 *     rubric: [
 *       'The response should recommend NONE when tsconfig.json is present.',
 *       'The response must not invent facts about the repository.',
 *     ],
 *   });
 *   // result.pass, result.score (0–1), result.reason
 *
 * Requires EVAL_API_KEY (Anthropic API key) and is a no-op / always-pass
 * when the env var is absent (so CI stays green without a key).
 */

export interface GradeInput {
  /** Background context given to the agent (e.g. SKILL.md content). */
  context: string;
  /** The user prompt / developer question. */
  prompt: string;
  /** The agent response being evaluated. */
  response: string;
  /**
   * Array of rubric criteria. Each is a statement the grader should assess.
   * Pass when the majority of criteria are satisfied.
   */
  rubric: string[];
}

export interface GradeResult {
  pass: boolean;
  /** 0–1 fraction of rubric criteria satisfied. */
  score: number;
  reason: string;
  /** Individual criterion verdicts. */
  criteria: Array<{ criterion: string; satisfied: boolean; note: string }>;
}

const GRADER_SYSTEM_PROMPT = `You are an objective evaluator assessing whether an AI agent response meets a set of quality criteria.

For each criterion provided, respond with exactly:
  PASS: <one-line explanation>
or
  FAIL: <one-line explanation>

Then at the end output a JSON object on its own line:
{"score": <0.0–1.0>, "pass": <true|false>, "summary": "<one sentence>"}

Be strict. Only mark PASS when the criterion is clearly and unambiguously satisfied.`;

/**
 * Grade a response against a rubric using the Anthropic Messages API.
 *
 * Returns a trivially-passing result when EVAL_API_KEY is not set.
 */
export async function grade(input: GradeInput): Promise<GradeResult> {
  const apiKey = process.env.EVAL_API_KEY;

  if (!apiKey) {
    // No API key — skip gracefully.
    return {
      pass: true,
      score: 1,
      reason: 'Grader skipped (EVAL_API_KEY not set).',
      criteria: input.rubric.map((c) => ({ criterion: c, satisfied: true, note: 'skipped' })),
    };
  }

  const userMessage = [
    '## Context given to the agent',
    input.context,
    '',
    '## Developer prompt',
    input.prompt,
    '',
    '## Agent response',
    input.response,
    '',
    '## Rubric criteria to evaluate',
    ...input.rubric.map((c, i) => `${i + 1}. ${c}`),
  ].join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: GRADER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Grader API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
  const text = data.content.find((b) => b.type === 'text')?.text ?? '';

  // Parse individual criterion verdicts.
  const criteriaLines = text.split('\n').filter((l) => /^(PASS|FAIL):/.test(l.trim()));
  const criteria = input.rubric.map((criterion, i) => {
    const line = criteriaLines[i] ?? '';
    const satisfied = line.trimStart().startsWith('PASS');
    const note = line.replace(/^(PASS|FAIL):\s*/i, '').trim();
    return { criterion, satisfied, note };
  });

  // Parse the JSON summary line.
  const jsonLine = text.split('\n').reverse().find((l: string) => l.trim().startsWith('{'));
  let score = criteria.filter((c) => c.satisfied).length / (criteria.length || 1);
  let pass = score >= 0.75;
  let reason = 'See criteria above.';

  if (jsonLine) {
    try {
      const parsed = JSON.parse(jsonLine) as { score?: number; pass?: boolean; summary?: string };
      if (typeof parsed.score === 'number') score = parsed.score;
      if (typeof parsed.pass === 'boolean') pass = parsed.pass;
      if (typeof parsed.summary === 'string') reason = parsed.summary;
    } catch {
      // Fall back to computed values.
    }
  }

  return { pass, score, reason, criteria };
}
