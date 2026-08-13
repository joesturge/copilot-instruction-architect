/**
 * Classification categories for candidate knowledge.
 *
 * Prefer the simplest mechanism that provides the required behaviour.
 * See: classification engine specification.
 */
export type Classification =
  | 'NONE'
  | 'GLOBAL_INSTRUCTION'
  | 'PATH_INSTRUCTION'
  | 'SKILL'
  | 'PROMPT'
  | 'AGENT'
  | 'DOCUMENTATION_ONLY';

export interface KnowledgeItem {
  /** Raw text of the candidate knowledge. */
  content: string;
  /** Source file this was extracted from, if known. */
  sourceFile?: string;
  /** Glob pattern for path scoping, if applicable. */
  pathGlob?: string;
}

export interface ClassificationResult {
  classification: Classification;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  suggestedPath?: string;
  suggestedPathGlob?: string;
}

export interface AuditFinding {
  type:
    | 'duplicate'
    | 'contradiction'
    | 'stale'
    | 'overly_broad'
    | 'discoverable'
    | 'misplaced'
    | 'missing';
  description: string;
  affectedItems: KnowledgeItem[];
  recommendation: string;
}

export interface AuditResult {
  existingFiles: string[];
  findings: AuditFinding[];
  recommendations: string[];
  estimatedContextReduction?: number;
}
