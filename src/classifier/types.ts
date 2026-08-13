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

export type ProposalAction = 'create' | 'update' | 'delete';

export interface FileProposal {
  action: ProposalAction;
  /** Relative path within the repository (must start with .github/). */
  path: string;
  /** File content for create/update actions. */
  content?: string;
  /** applyTo glob for .github/instructions files. */
  applyTo?: string;
  reason: string;
}

export interface RepositoryProposal {
  proposals: FileProposal[];
  summary: string;
}
