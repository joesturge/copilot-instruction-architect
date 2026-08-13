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
