import type {
  Classification,
  DeterministicClassificationEvidence,
  KnowledgeItem,
  RepositoryProfile,
  SemanticClassificationResult,
} from './types.js';
import { classify } from './classifier.js';
import {
  detectContradictions,
  detectDiscoverable,
  detectDuplicates,
  detectSemanticOverlap,
} from './detector.js';
import type { AuditFinding } from './types.js';

export interface SemanticClassifierRequest {
  candidate: KnowledgeItem;
  evidence: DeterministicClassificationEvidence;
  relatedItems: Array<Pick<KnowledgeItem, 'content' | 'sourceFile' | 'pathGlob'>>;
}

export interface SemanticClassifier {
  classify(request: SemanticClassifierRequest): Promise<unknown>;
}

interface HybridClassificationOptions {
  semanticClassifier?: SemanticClassifier;
  allItems?: KnowledgeItem[];
  repoProfile?: RepositoryProfile;
  precomputedSignals?: {
    duplicates: AuditFinding[];
    overlap: AuditFinding[];
    contradictions: AuditFinding[];
  };
}

const VALID_CLASSIFICATIONS: Classification[] = [
  'NONE',
  'GLOBAL_INSTRUCTION',
  'PATH_INSTRUCTION',
  'SKILL',
  'PROMPT',
  'AGENT',
  'DOCUMENTATION_ONLY',
];

export async function classifyHybrid(
  item: KnowledgeItem,
  options: HybridClassificationOptions = {}
): Promise<SemanticClassificationResult> {
  const deterministic = classify(item);
  const evidence = buildDeterministicEvidence(
    item,
    deterministic,
    options.allItems ?? [item],
    options.repoProfile ?? emptyProfile(),
    options.precomputedSignals,
  );

  if (!shouldEscalateToLLM(item, evidence) || !options.semanticClassifier) {
    return fromDeterministic(item, evidence);
  }

  const relatedItems = findRelatedItems(item, options.allItems ?? [item]);
  const raw = await options.semanticClassifier
    .classify({ candidate: item, evidence, relatedItems })
    .catch(() => null);
  const validated = validateSemanticResult(raw);
  if (!validated || validated.confidence < 0.55) {
    const fallback = fromDeterministic(item, evidence);
    fallback.source = 'fallback';
    fallback.reason = validated
      ? `${fallback.reason} LLM confidence was too low, so deterministic fallback was used.`
      : `${fallback.reason} LLM response was invalid, so deterministic fallback was used.`;
    return fallback;
  }

  return {
    ...validated,
    suggestedPath: deriveSuggestedPath(validated.classification, item),
    suggestedPathGlob:
      validated.classification === 'PATH_INSTRUCTION' ? item.pathGlob ?? deterministic.suggestedPathGlob : undefined,
    source: 'llm',
  };
}

export async function classifyAllHybrid(
  items: KnowledgeItem[],
  options: Omit<HybridClassificationOptions, 'allItems'> = {}
): Promise<SemanticClassificationResult[]> {
  const precomputedSignals = {
    duplicates: detectDuplicates(items),
    overlap: detectSemanticOverlap(items),
    contradictions: detectContradictions(items),
  };
  const concurrency = 4;
  const results: SemanticClassificationResult[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (true) {
      const current = index;
      index++;
      if (current >= items.length) return;
      results[current] = await classifyHybrid(items[current], {
        ...options,
        allItems: items,
        precomputedSignals,
      });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function shouldEscalateToLLM(
  item: KnowledgeItem,
  evidence: DeterministicClassificationEvidence
): boolean {
  const deterministic = evidence.deterministicClassification;
  if (!item.content.trim()) return false;

  // Obvious discoverable/no-op cases stay deterministic to avoid unnecessary cost.
  if (
    deterministic.classification === 'NONE' &&
    deterministic.confidence === 'high' &&
    evidence.discoverableSignals.length > 0
  ) {
    return false;
  }

  const hasAmbiguitySignals =
    evidence.duplicateSignals.length > 0 ||
    evidence.overlapSignals.length > 0 ||
    evidence.contradictionSignals.length > 0;
  if (hasAmbiguitySignals) return true;

  // Cheap deterministic filter: skip LLM when deterministic confidence is high and unambiguous.
  if (deterministic.confidence === 'high') return false;

  // Escalate medium/low confidence behavioural classifications for semantic judgement.
  if (['GLOBAL_INSTRUCTION', 'PATH_INSTRUCTION', 'SKILL', 'PROMPT', 'AGENT'].includes(deterministic.classification)) {
    return true;
  }

  return false;
}

function fromDeterministic(
  item: KnowledgeItem,
  evidence: DeterministicClassificationEvidence
): SemanticClassificationResult {
  const base = evidence.deterministicClassification;
  const confidence = base.confidence === 'high' ? 0.85 : base.confidence === 'medium' ? 0.65 : 0.45;
  return {
    classification: base.classification,
    confidence,
    reason: base.reason,
    scope: item.pathGlob ? `Path-scoped (${item.pathGlob})` : 'Repository/global by default',
    value:
      base.classification === 'NONE'
        ? 'Low value because the agent can discover this directly.'
        : 'Potentially useful behavioural guidance for future agents.',
    contextCost:
      base.classification === 'GLOBAL_INSTRUCTION'
        ? 'Always loaded context; keep concise.'
        : base.classification === 'PATH_INSTRUCTION'
          ? 'Loaded only for matching files.'
          : base.classification === 'SKILL' || base.classification === 'PROMPT'
            ? 'On-demand context.'
            : 'Minimal additional context.',
    maintenanceCost:
      base.classification === 'NONE'
        ? 'No maintenance if omitted.'
        : 'Moderate maintenance; keep linked to source of truth and avoid duplication.',
    evidence: deterministicEvidenceSummary(evidence),
    alternatives: collectAlternatives(base.classification),
    suggestedPath: base.suggestedPath ?? deriveSuggestedPath(base.classification, item),
    suggestedPathGlob: base.suggestedPathGlob ?? item.pathGlob,
    source: 'deterministic',
  };
}

function buildDeterministicEvidence(
  item: KnowledgeItem,
  deterministicClassification: DeterministicClassificationEvidence['deterministicClassification'],
  items: KnowledgeItem[],
  repoProfile: RepositoryProfile,
  precomputedSignals?: {
    duplicates: AuditFinding[];
    overlap: AuditFinding[];
    contradictions: AuditFinding[];
  },
): DeterministicClassificationEvidence {
  const duplicates = (precomputedSignals?.duplicates ?? detectDuplicates(items)).filter((f) =>
    f.affectedItems.includes(item)
  );
  const overlap = (precomputedSignals?.overlap ?? detectSemanticOverlap(items)).filter((f) =>
    f.affectedItems.includes(item)
  );
  const contradictions = (precomputedSignals?.contradictions ?? detectContradictions(items)).filter((f) =>
    f.affectedItems.includes(item)
  );
  const discoverable = detectDiscoverable([item]);
  return {
    deterministicClassification,
    duplicateSignals: duplicates,
    overlapSignals: overlap,
    contradictionSignals: contradictions,
    discoverableSignals: discoverable,
    repoProfile,
  };
}

function deterministicEvidenceSummary(evidence: DeterministicClassificationEvidence): string[] {
  const out: string[] = [];
  out.push(`Deterministic classification: ${evidence.deterministicClassification.classification}`);
  if (evidence.repoProfile.packageManager) {
    out.push(`Detected package manager: ${evidence.repoProfile.packageManager}`);
  }
  if (evidence.repoProfile.sourceOfTruthFiles.length > 0) {
    out.push(`Source-of-truth files: ${evidence.repoProfile.sourceOfTruthFiles.join(', ')}`);
  }
  if (evidence.duplicateSignals.length > 0) out.push(`Possible duplicates: ${evidence.duplicateSignals.length}`);
  if (evidence.overlapSignals.length > 0) out.push(`Possible overlaps: ${evidence.overlapSignals.length}`);
  if (evidence.contradictionSignals.length > 0) out.push(`Possible contradictions: ${evidence.contradictionSignals.length}`);
  if (evidence.discoverableSignals.length > 0) out.push('Likely discoverable fact detected.');
  return out;
}

function collectAlternatives(chosen: Classification): Classification[] {
  return VALID_CLASSIFICATIONS.filter((c) => c !== chosen).slice(0, 3);
}

function deriveSuggestedPath(classification: Classification, item: KnowledgeItem): string | undefined {
  const slug = slugFromContent(item.content);
  if (classification === 'GLOBAL_INSTRUCTION') return '.github/copilot-instructions.md';
  if (classification === 'PATH_INSTRUCTION') return `.github/instructions/${slug}.instructions.md`;
  if (classification === 'SKILL') return `.github/skills/${slug}/SKILL.md`;
  if (classification === 'PROMPT') return `.github/prompts/${slug}.prompt.md`;
  if (classification === 'AGENT') return `.github/agents/${slug}.agent.md`;
  if (classification === 'DOCUMENTATION_ONLY') return item.sourceFile?.endsWith('.md') ? item.sourceFile : 'README.md';
  return undefined;
}

function findRelatedItems(
  item: KnowledgeItem,
  items: KnowledgeItem[]
): Array<Pick<KnowledgeItem, 'content' | 'sourceFile' | 'pathGlob'>> {
  const itemWords = normaliseWords(item.content);
  const scored = items
    .filter((other) => other !== item)
    .map((other) => {
      const overlap = jaccard(itemWords, normaliseWords(other.content));
      return { other, overlap };
    })
    .filter((x) => x.overlap >= 0.15)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 8)
    .map((x) => ({
      content: x.other.content,
      sourceFile: x.other.sourceFile,
      pathGlob: x.other.pathGlob,
    }));
  return scored;
}

function normaliseWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((w) => b.has(w)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function validateSemanticResult(raw: unknown): SemanticClassificationResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<SemanticClassificationResult>;
  if (!r.classification || !VALID_CLASSIFICATIONS.includes(r.classification)) return null;
  if (typeof r.confidence !== 'number' || Number.isNaN(r.confidence)) return null;
  if (typeof r.reason !== 'string' || !r.reason.trim()) return null;
  if (typeof r.scope !== 'string') return null;
  if (typeof r.value !== 'string') return null;
  if (typeof r.contextCost !== 'string') return null;
  if (typeof r.maintenanceCost !== 'string') return null;
  if (!Array.isArray(r.evidence) || !r.evidence.every((x) => typeof x === 'string')) return null;
  if (!Array.isArray(r.alternatives) || !r.alternatives.every((x) => VALID_CLASSIFICATIONS.includes(x))) return null;
  return {
    classification: r.classification,
    confidence: Math.max(0, Math.min(1, r.confidence)),
    reason: r.reason,
    scope: r.scope,
    value: r.value,
    contextCost: r.contextCost,
    maintenanceCost: r.maintenanceCost,
    evidence: r.evidence,
    alternatives: r.alternatives,
    suggestedPath: r.suggestedPath,
    suggestedPathGlob: r.suggestedPathGlob,
    source: 'llm',
  };
}

function emptyProfile(): RepositoryProfile {
  return {
    lockfiles: [],
    hasCiWorkflow: false,
    ciFiles: [],
    testConfigFiles: [],
    copilotFiles: [],
    sourceOfTruthFiles: [],
  };
}

function slugFromContent(content: string): string {
  const slug = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join('-');
  return slug || 'repository-guidance';
}
