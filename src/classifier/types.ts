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
  /** Stable item id for dedupe/conflict analysis. */
  id?: string;
  /** Raw text of the candidate knowledge. */
  content: string;
  /** Source file this was extracted from, if known. */
  sourceFile?: string;
  /** Type of source where this item came from. */
  sourceType?: 'copilot' | 'instructions' | 'skill' | 'prompt' | 'agent' | 'external' | 'docs' | 'unknown';
  /** Glob pattern for path scoping, if applicable. */
  pathGlob?: string;
  /** Inferred scope for this item. */
  scope?: 'global' | 'path' | 'unknown';
  /** How stable this guidance appears to be over time. */
  stability?: 'high' | 'medium' | 'low';
  /** Whether this guidance appears discoverable from repository sources. */
  discoverability?: 'high' | 'medium' | 'low';
  /** Estimated behavioural value to future agents. */
  behaviouralValue?: 'high' | 'medium' | 'low';
  /** Confidence in deterministic extraction quality. */
  extractionConfidence?: number;
  /** Related item ids, when known. */
  relatedItems?: string[];
  /** Source-of-truth evidence references. */
  sourceOfTruth?: string[];
  /** Why this item exists in the knowledge model. */
  rationale?: string;
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

export interface RepositoryProfile {
  packageManager?: string;
  lockfiles: string[];
  hasCiWorkflow: boolean;
  ciFiles: string[];
  testConfigFiles: string[];
  copilotFiles: string[];
  sourceOfTruthFiles: string[];
}

export interface DeterministicClassificationEvidence {
  deterministicClassification: ClassificationResult;
  duplicateSignals: AuditFinding[];
  overlapSignals: AuditFinding[];
  contradictionSignals: AuditFinding[];
  discoverableSignals: AuditFinding[];
  repoProfile: RepositoryProfile;
}

export interface SemanticClassificationResult {
  classification: Classification;
  confidence: number;
  reason: string;
  scope: string;
  value: string;
  contextCost: string;
  maintenanceCost: string;
  evidence: string[];
  alternatives: Classification[];
  suggestedPath?: string;
  suggestedPathGlob?: string;
  source: 'deterministic' | 'llm' | 'fallback';
}
