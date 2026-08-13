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

export async function evaluateConversationKnowledge(
  repoRoot: string,
  observations: ConversationObservation[],
  options: { semanticClassifier?: SemanticClassifier } = {}
): Promise<RepositoryKnowledgeEvaluation> {
  const { items: repositoryItems, existingFiles, profile } = await analyseRepository(repoRoot);
  const conversationItems = extractConversationKnowledge(observations);
  const merged = [...repositoryItems, ...conversationItems];
  const evaluation = await evaluateKnowledgeItems(merged, profile, options);
  const conversationSet = new Set(conversationItems);
  return {
    ...evaluation,
    existingFiles,
    decisions: evaluation.decisions.filter((decision) => conversationSet.has(decision.item)),
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

  const decisions: KnowledgeRepresentationDecision[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const semantic = classified[i];
    const itemIsDiscoverable = hasSignal(item, discoverable);
    const itemIsDuplicate = hasSignal(item, duplicates);
    const itemHasConflict = hasSignal(item, contradictions);
    const shouldPersist =
      semantic.classification !== 'NONE' && semantic.classification !== 'DOCUMENTATION_ONLY';

    decisions.push({
      item,
      semantic,
      shouldPersist,
      conflict: itemHasConflict,
      duplicate: itemIsDuplicate,
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

function extractConversationKnowledge(observations: ConversationObservation[]): KnowledgeItem[] {
  const grouped = new Map<string, { sample: ConversationObservation; count: number }>();
  for (const observation of observations) {
    const key = normalise(observation.description);
    const existing = grouped.get(key);
    if (existing) {
      existing.count++;
    } else {
      grouped.set(key, { sample: observation, count: 1 });
    }
  }

  const items: KnowledgeItem[] = [];
  let index = 0;
  for (const { sample, count } of grouped.values()) {
    items.push({
      id: `conversation:${index++}`,
      content: sample.description,
      sourceType: 'external',
      sourceFile: '[conversation]',
      scope: 'unknown',
      stability: count >= 2 ? 'high' : 'medium',
      discoverability: 'low',
      behaviouralValue: sample.type === 'security_issue' ? 'high' : 'medium',
      relatedItems: [`observation_count:${count}`, `observation_type:${sample.type}`],
      rationale:
        count >= 2
          ? `Observed repeatedly in conversation (${count} mentions).`
          : 'Observed once in conversation; persistence depends on semantic value.',
    });
  }
  return items;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}
