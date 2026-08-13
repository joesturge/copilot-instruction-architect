import type { KnowledgeItem, AuditFinding } from './types.js';

/**
 * Compute a simple normalised fingerprint for semantic comparison.
 * This is intentionally lightweight — not a full NLP model.
 */
function fingerprint(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/** Jaccard similarity between two word sets, range [0, 1]. */
function similarity(a: string, b: string): number {
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 1 : intersection.size / union.size;
}

export const DUPLICATE_THRESHOLD = 0.75;
export const OVERLAP_THRESHOLD = 0.5;

/**
 * Detect exact or near-duplicate knowledge items.
 *
 * Items with Jaccard similarity ≥ DUPLICATE_THRESHOLD are considered duplicates.
 */
export function detectDuplicates(items: KnowledgeItem[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const fps = items.map((item) => fingerprint(item.content));

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = similarity(fps[i], fps[j]);
      if (sim >= DUPLICATE_THRESHOLD) {
        findings.push({
          type: 'duplicate',
          description: `Items ${i} and ${j} are near-identical (similarity ${(sim * 100).toFixed(0)}%).`,
          affectedItems: [items[i], items[j]],
          recommendation: 'Merge into a single canonical rule and remove the duplicate.',
        });
      }
    }
  }

  return findings;
}

/**
 * Detect semantic overlap that is below the duplicate threshold but still
 * significant enough to be redundant.
 */
export function detectSemanticOverlap(items: KnowledgeItem[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const fps = items.map((item) => fingerprint(item.content));

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = similarity(fps[i], fps[j]);
      if (sim >= OVERLAP_THRESHOLD && sim < DUPLICATE_THRESHOLD) {
        findings.push({
          type: 'overly_broad',
          description: `Items ${i} and ${j} overlap significantly (similarity ${(sim * 100).toFixed(0)}%). Consider consolidating.`,
          affectedItems: [items[i], items[j]],
          recommendation: 'Review whether both items are necessary or can be merged.',
        });
      }
    }
  }

  return findings;
}

/**
 * Detect contradictory instructions by looking for negation pairs.
 *
 * This is a heuristic: it looks for pairs where one item affirms something
 * the other denies.
 */
export function detectContradictions(items: KnowledgeItem[]): AuditFinding[] {
  const findings: AuditFinding[] = [];

  const AFFIRMATION = /\b(always|must|should|do|use|prefer|keep|update|add|include)\b/i;
  const NEGATION = /\b(never|must not|should not|do not|don't|avoid|skip|exclude|remove)\b/i;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i].content;
      const b = items[j].content;
      const fps_i = fingerprint(a);
      const fps_j = fingerprint(b);
      const sim = similarity(fps_i, fps_j);

      // Items must share some content to potentially contradict each other.
      if (sim < 0.2) continue;

      const aAffirms = AFFIRMATION.test(a);
      const aNegates = NEGATION.test(a);
      const bAffirms = AFFIRMATION.test(b);
      const bNegates = NEGATION.test(b);

      if ((aAffirms && bNegates) || (aNegates && bAffirms)) {
        findings.push({
          type: 'contradiction',
          description: `Items ${i} and ${j} may contradict each other — one affirms while the other negates similar content.`,
          affectedItems: [items[i], items[j]],
          recommendation: 'Review both items and resolve the contradiction by keeping the current intended behaviour.',
        });
      }
    }
  }

  return findings;
}

/**
 * Detect information that is already discoverable from standard repository
 * sources (package manifests, lockfiles, CI, etc.) and should not occupy
 * persistent instruction context.
 */
export function detectDiscoverable(items: KnowledgeItem[]): AuditFinding[] {
  const DISCOVERABLE: RegExp[] = [
    /\buse[s]?\s+(pnpm|npm|yarn|bun)\b/i,
    /\bpackage\s+manager\s+is\b/i,
    /\bwritten\s+in\s+(typescript|javascript|python|go|rust|java)\b/i,
    /\bthe\s+project\s+uses?\s+\w+\b/i,
    /\bthis\s+repo(sitory)?\s+(is|uses?)\b/i,
    /\bmonorepo\b.*\busing\b/i,
    /\bnode\.?js\s+version\b/i,
    /\brequires?\s+node\s+\d+/i,
  ];

  const findings: AuditFinding[] = [];

  for (const item of items) {
    if (DISCOVERABLE.some((p) => p.test(item.content))) {
      findings.push({
        type: 'discoverable',
        description: `"${item.content.slice(0, 80)}…" describes a fact that can be discovered from repository files.`,
        affectedItems: [item],
        recommendation:
          'Remove this instruction. The agent can discover this from package.json, lockfiles, or CI configuration.',
      });
    }
  }

  return findings;
}
