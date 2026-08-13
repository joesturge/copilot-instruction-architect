import { analyseRepository } from '../analyser/analyser.js';
import {
  detectContradictions,
  detectDiscoverable,
  detectDuplicates,
  detectSemanticOverlap,
} from '../classifier/detector.js';
import { classifyAllHybrid } from '../classifier/hybrid.js';
import type { SemanticClassifier } from '../classifier/hybrid.js';
import type {
  AuditFinding,
  Classification,
  KnowledgeItem,
  RepositoryProfile,
  SemanticClassificationResult,
} from '../classifier/types.js';

export interface KnowledgeRepresentationDecision {
  item: KnowledgeItem;
  semantic: SemanticClassificationResult;
  shouldPersist: boolean;
  conflict: boolean;
  duplicate: boolean;
  discoverable: boolean;
}

export interface RepositoryKnowledgeEvaluation {
  items: KnowledgeItem[];
  existingFiles: string[];
  profile: RepositoryProfile;
  findings: AuditFinding[];
  decisions: KnowledgeRepresentationDecision[];
}

export async function evaluateRepositoryKnowledge(
  repoRoot: string,
  options: { semanticClassifier?: SemanticClassifier } = {}
): Promise<RepositoryKnowledgeEvaluation> {
  const { items, existingFiles, profile } = await analyseRepository(repoRoot);
  const evaluation = await evaluateKnowledgeItems(items, profile, options);
  return {
    ...evaluation,
    existingFiles,
  };
}

export async function evaluateKnowledgeItems(
  items: KnowledgeItem[],
  profile: RepositoryProfile,
  options: { semanticClassifier?: SemanticClassifier } = {}
): Promise<Omit<RepositoryKnowledgeEvaluation, 'existingFiles'>> {
  const duplicates = detectDuplicates(items);
  const overlap = detectSemanticOverlap(items);
  const contradictions = detectContradictions(items);
  const discoverable = detectDiscoverable(items);
  const findings = [...duplicates, ...overlap, ...contradictions, ...discoverable];

  const classified = await classifyAllHybrid(items, {
    semanticClassifier: options.semanticClassifier,
    repoProfile: profile,
  });

  const seenCanonical = new Set<string>();
  const decisions: KnowledgeRepresentationDecision[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const semantic = classified[i];
    const itemIsDiscoverable = hasSignal(item, discoverable);
    const itemIsDuplicate = hasSignal(item, duplicates);
    const itemHasConflict = hasSignal(item, contradictions);
    const canonical = canonicalKey(item, semantic.classification);
    const alreadyIncluded = seenCanonical.has(canonical);

    const shouldPersist =
      !itemIsDiscoverable &&
      !itemHasConflict &&
      !alreadyIncluded &&
      semantic.classification !== 'NONE' &&
      semantic.classification !== 'DOCUMENTATION_ONLY';

    if (shouldPersist) seenCanonical.add(canonical);

    decisions.push({
      item,
      semantic,
      shouldPersist,
      conflict: itemHasConflict,
      duplicate: itemIsDuplicate || alreadyIncluded,
      discoverable: itemIsDiscoverable,
    });
  }

  return { items, profile, findings, decisions };
}

export interface RepresentationBuckets {
  global: KnowledgeRepresentationDecision[];
  path: Map<string, KnowledgeRepresentationDecision[]>;
  skills: KnowledgeRepresentationDecision[];
  prompts: KnowledgeRepresentationDecision[];
  agents: KnowledgeRepresentationDecision[];
  dropped: KnowledgeRepresentationDecision[];
}

export function groupRepresentationDecisions(
  decisions: KnowledgeRepresentationDecision[]
): RepresentationBuckets {
  const global: KnowledgeRepresentationDecision[] = [];
  const path = new Map<string, KnowledgeRepresentationDecision[]>();
  const skills: KnowledgeRepresentationDecision[] = [];
  const prompts: KnowledgeRepresentationDecision[] = [];
  const agents: KnowledgeRepresentationDecision[] = [];
  const dropped: KnowledgeRepresentationDecision[] = [];

  for (const decision of decisions) {
    if (!decision.shouldPersist) {
      dropped.push(decision);
      continue;
    }
    switch (decision.semantic.classification) {
      case 'GLOBAL_INSTRUCTION':
        global.push(decision);
        break;
      case 'PATH_INSTRUCTION': {
        const glob = decision.semantic.suggestedPathGlob ?? decision.item.pathGlob ?? '*';
        const existing = path.get(glob) ?? [];
        existing.push(decision);
        path.set(glob, existing);
        break;
      }
      case 'SKILL':
        skills.push(decision);
        break;
      case 'PROMPT':
        prompts.push(decision);
        break;
      case 'AGENT':
        agents.push(decision);
        break;
      default:
        dropped.push(decision);
    }
  }

  return { global, path, skills, prompts, agents, dropped };
}

function hasSignal(item: KnowledgeItem, findings: AuditFinding[]): boolean {
  return findings.some((finding) => finding.affectedItems.includes(item));
}

function canonicalKey(item: KnowledgeItem, classification: Classification): string {
  return `${classification}:${item.pathGlob ?? ''}:${normalise(item.content)}`;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}
