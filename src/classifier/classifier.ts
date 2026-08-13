import type {
  Classification,
  ClassificationResult,
  KnowledgeItem,
} from './types.js';

/**
 * Heuristics for determining when knowledge is already discoverable from
 * standard repository files, and therefore should not consume instruction
 * context.
 */
const DISCOVERABLE_PATTERNS: RegExp[] = [
  /\buse[s]?\s+(pnpm|npm|yarn|bun)\b/i,
  /\bpackage\s+manager\s+is\b/i,
  /\bwritten\s+in\s+(typescript|javascript|python|go|rust|java)\b/i,
  /\bthe\s+project\s+uses?\s+\w+\b/i,
  /\bthis\s+repo(sitory)?\s+(is|uses?)\b/i,
  /\bmonorepo\b.*\busing\b/i,
];

/**
 * Patterns that suggest a skill (multi-step, procedural, reusable workflow).
 */
const SKILL_PATTERNS: RegExp[] = [
  /\bstep[s]?\b.*\b(first|then|next|finally)\b/i,
  /\b(run|execute|perform)\b.*\bthen\b.*\b(run|check|verify)\b/i,
  /\b(workflow|process|procedure|pipeline)\b/i,
  /^\s*\d+\.\s+.+$/m, // numbered list of steps
];

/**
 * Patterns that suggest a prompt (explicit user-invoked operation).
 */
const PROMPT_PATTERNS: RegExp[] = [
  /\baudit\b/i,
  /\breview\b/i,
  /\bgenerate\s+(report|summary)\b/i,
  /\bcheck\s+(all|every)\b/i,
  /\bscan\b/i,
];

/**
 * Patterns that suggest path scoping is appropriate.
 */
const PATH_SCOPE_PATTERNS: Array<{ pattern: RegExp; glob: string }> = [
  { pattern: /\btest[s]?\b|\bspec[s]?\b|\bunit\b|\bintegration\b/i, glob: '**/*.test.*,**/*.spec.*,tests/**' },
  { pattern: /\bapi\b|\bcontract\b|\bendpoint\b/i, glob: 'src/api/**,api/**' },
  { pattern: /\bmigration[s]?\b/i, glob: 'migrations/**,db/migrations/**' },
  { pattern: /\bcomponent[s]?\b/i, glob: 'src/components/**' },
  { pattern: /\bci\b|\bgithub actions\b|\bworkflow[s]?\b/i, glob: '.github/workflows/**' },
  { pattern: /\bdocumentation?\b|\bdocs?\b/i, glob: 'docs/**,*.md' },
];

/**
 * Determine the most appropriate knowledge classification for a given item.
 *
 * Follows the principle: prefer the simplest useful mechanism.
 * Already discoverable → NONE
 * Repository-wide behaviour → GLOBAL_INSTRUCTION
 * Scoped behaviour → PATH_INSTRUCTION
 * Repeatable workflow → SKILL
 * Explicit user operation → PROMPT
 * Distinct autonomous role → AGENT (rare)
 */
export function classify(item: KnowledgeItem): ClassificationResult {
  const text = item.content.trim();

  if (!text) {
    return {
      classification: 'NONE',
      confidence: 'high',
      reason: 'Empty content provides no value.',
    };
  }

  // Check if the information is already discoverable from standard repo files.
  if (DISCOVERABLE_PATTERNS.some((p) => p.test(text))) {
    return {
      classification: 'NONE',
      confidence: 'high',
      reason:
        'This fact can be reliably discovered from package manifests, lockfiles, or other repository sources. Adding it to instructions wastes persistent context.',
    };
  }

  // Multi-step workflow → skill (check before path scoping).
  if (SKILL_PATTERNS.some((p) => p.test(text))) {
    return {
      classification: 'SKILL',
      confidence: 'medium',
      reason:
        'This describes a multi-step or procedural workflow. A skill loads on-demand and avoids consuming persistent context.',
      suggestedPath: `.github/skills/${deriveSkillName(text)}/SKILL.md`,
    };
  }

  // Explicit user operation → prompt.
  if (PROMPT_PATTERNS.some((p) => p.test(text))) {
    return {
      classification: 'PROMPT',
      confidence: 'medium',
      reason:
        'This operation is best invoked explicitly by the user rather than loaded persistently.',
      suggestedPath: `.github/prompts/${derivePromptName(text)}.prompt.md`,
    };
  }

  // Repository-wide behavioural guidance → global instruction.
  // Check this before path scoping: if it applies everywhere, do not narrow it.
  if (isBehavioural(text) && isRepositoryWide(text)) {
    return {
      classification: 'GLOBAL_INSTRUCTION',
      confidence: 'high',
      reason:
        'This is stable behavioural guidance that explicitly applies across the repository.',
      suggestedPath: '.github/copilot-instructions.md',
    };
  }

  // Check for path-scoped content.
  // Only apply path scoping when the instruction explicitly scopes itself to
  // a subset of files (not when it's a general behavioural rule that happens
  // to mention the word "test" etc.).
  const pathScope = PATH_SCOPE_PATTERNS.find(({ pattern }) => pattern.test(text));
  if (pathScope && !isRepositoryWide(text) && isExplicitlyPathScoped(text)) {
    return {
      classification: 'PATH_INSTRUCTION',
      confidence: 'medium',
      reason: 'This guidance applies to a specific subset of files rather than the whole repository.',
      suggestedPath: `.github/instructions/${deriveInstructionName(text)}.instructions.md`,
      suggestedPathGlob: item.pathGlob ?? pathScope.glob,
    };
  }

  // Stable repository-wide behavioural guidance → global instruction.
  if (isBehavioural(text)) {
    return {
      classification: 'GLOBAL_INSTRUCTION',
      confidence: 'medium',
      reason:
        'This is stable behavioural guidance that applies across the repository and benefits from persistent context.',
      suggestedPath: '.github/copilot-instructions.md',
    };
  }

  return {
    classification: 'DOCUMENTATION_ONLY',
    confidence: 'low',
    reason:
      'This appears to be documentation or a fact rather than agent behavioural guidance. Consider whether it belongs in README or CONTRIBUTING instead.',
  };
}

/**
 * Returns true when the text explicitly scopes itself to a subset of files.
 * This distinguishes "All test files must ..." (path-scoped) from
 * "Always update tests when ..." (repository-wide behavioural rule).
 */
function isExplicitlyPathScoped(text: string): boolean {
  const scopedMarkers = [
    /\b(test|spec|api|migration|component|ci|doc|docs)\s+files?\b/i,
    /\bin\s+(test|spec|api|migration|component|ci|doc|docs)\s+files?\b/i,
    /\bfiles?\s+in\s+(the\s+)?(test|spec|api|src|lib|docs?)\b/i,
    /\bwhen\s+editing\s+(test|spec|api|migration)\b/i,
    /applyTo/i,
  ];
  return scopedMarkers.some((p) => p.test(text));
}


function isBehavioural(text: string): boolean {
  const behaviouralMarkers = [
    /\balways\b/i,
    /\bnever\b/i,
    /\bdo not\b/i,
    /\bdo\b.*\bwhen\b/i,
    /\bmust\b/i,
    /\bshould\b/i,
    /\bprefer\b/i,
    /\bavoid\b/i,
    /\bensure\b/i,
    /\bkeep\b/i,
    /\bupdate\b.*\bwhen\b/i,
    /\bfix\b.*\bwhen\b/i,
  ];
  return behaviouralMarkers.some((p) => p.test(text));
}

/** Returns true when text clearly applies to the whole repository. */
function isRepositoryWide(text: string): boolean {
  const globalMarkers = [
    /\ball\s+files?\b/i,
    /\bany\s+file\b/i,
    /\bthe\s+codebase\b/i,
    /\bacross\s+the\s+repo/i,
  ];
  return globalMarkers.some((p) => p.test(text));
}

function deriveInstructionName(text: string): string {
  const words = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).slice(0, 3);
  return words.join('-') || 'path-guidance';
}

function deriveSkillName(text: string): string {
  const words = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).slice(0, 3);
  return words.join('-') || 'workflow';
}

function derivePromptName(text: string): string {
  const words = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).slice(0, 3);
  return words.join('-') || 'operation';
}

/** Classify multiple items and return results in the same order. */
export function classifyAll(items: KnowledgeItem[]): ClassificationResult[] {
  return items.map(classify);
}

export { Classification };
