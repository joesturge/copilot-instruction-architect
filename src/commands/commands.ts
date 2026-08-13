import { analyseRepository } from '../analyser/analyser.js';
import { classify, classifyAll } from '../classifier/classifier.js';
import { classifyAllHybrid, classifyHybrid } from '../classifier/hybrid.js';
import { createSemanticClassifierFromEnv } from '../classifier/llm.js';
import {
  detectContradictions,
  detectDiscoverable,
  detectDuplicates,
  detectSemanticOverlap,
} from '../classifier/detector.js';
import { getBaseline } from '../baseline/baseline.js';
import {
  writeGlobalInstructions,
  readGlobalInstructions,
  writePathInstruction,
  writeSkill,
  writePrompt,
  formatInstructions,
} from '../io/writer.js';
import type { KnowledgeItem, AuditResult } from '../classifier/types.js';

/**
 * seed — analyse, bootstrap, migrate and normalise.
 *
 * Supports empty repositories (creates baseline), existing repositories
 * (reorganises), and messy repositories (deduplicates and normalises).
 * Idempotent: re-running does not cause churn when configuration is already good.
 */
export async function seed(repoRoot: string): Promise<string> {
  const { items: allItems, existingFiles, profile } = await analyseRepository(repoRoot);
  const baseline = getBaseline();
  const existing = await readGlobalInstructions(repoRoot);
  const semanticClassifier = createSemanticClassifierFromEnv();

  // Exclude items sourced from the global instructions file itself — we handle
  // that file separately below to avoid adding its contents back as extra rules
  // on re-runs (idempotency).
  const items = allItems.filter(
    (item) => item.sourceFile !== '.github/copilot-instructions.md'
  );

  const lines: string[] = ['# Instruction Architect — Seed\n'];

  // -- Classify all extracted items --
  const classified = await classifyAllHybrid(items, {
    semanticClassifier,
    repoProfile: profile,
  });
  const globalItems: KnowledgeItem[] = [];
  const pathItems: Map<string, KnowledgeItem[]> = new Map();
  const skillItems: KnowledgeItem[] = [];
  const promptItems: KnowledgeItem[] = [];
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const result = classified[i];
    switch (result.classification) {
      case 'GLOBAL_INSTRUCTION':
        globalItems.push(items[i]);
        break;
      case 'PATH_INSTRUCTION': {
        const glob = result.suggestedPathGlob ?? '*';
        const existing = pathItems.get(glob) ?? [];
        existing.push(items[i]);
        pathItems.set(glob, existing);
        break;
      }
      case 'SKILL':
        skillItems.push(items[i]);
        break;
      case 'PROMPT':
        promptItems.push(items[i]);
        break;
      default:
        skipped++;
    }
  }

  // -- Build global instructions --
  // Detect whether the baseline is already present to maintain idempotency.
  const baselineAlreadyPresent =
    existing.includes('## Documentation') &&
    existing.includes('## Testing') &&
    existing.includes('## Security');

  let globalContent = baselineAlreadyPresent
    ? existing
    : baseline.globalInstructions;

  if (globalItems.length > 0) {
    const extra = formatInstructions('Repository-specific guidance', globalItems);
    if (!globalContent.includes(extra.slice(0, 40))) {
      globalContent += '\n' + extra;
    }
  }

  await writeGlobalInstructions(repoRoot, globalContent);
  lines.push('✓ Wrote .github/copilot-instructions.md');

  // -- Write path instructions --
  for (const [glob, pathItemList] of pathItems) {
    const name = glob.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
    const content = formatInstructions('Guidance', pathItemList);
    await writePathInstruction(repoRoot, name, glob, content);
    lines.push(`✓ Wrote .github/instructions/${name}.instructions.md`);
  }

  // -- Write skills --
  if (skillItems.length > 0) {
    const content = formatInstructions('Workflow', skillItems);
    await writeSkill(repoRoot, 'extracted-workflows', content);
    lines.push('✓ Wrote .github/skills/extracted-workflows/SKILL.md');
  }

  // -- Write prompts --
  if (promptItems.length > 0) {
    const content = formatInstructions('Operations', promptItems);
    await writePrompt(repoRoot, 'extracted-operations', content);
    lines.push('✓ Wrote .github/prompts/extracted-operations.prompt.md');
  }

  lines.push('');
  lines.push(`Processed ${items.length} knowledge items from ${existingFiles.length} source files.`);
  lines.push(
    `Semantic classification mode: ${semanticClassifier ? 'LLM-assisted hybrid' : 'deterministic-only fallback'}`
  );
  lines.push(`Skipped ${skipped} items (discoverable or no value).`);
  lines.push('');
  lines.push('No custom agent was created — none was justified.');

  return lines.join('\n');
}

/**
 * audit — analyse the repository without modifying it.
 */
export async function audit(repoRoot: string): Promise<AuditResult> {
  const { items, existingFiles, profile } = await analyseRepository(repoRoot);
  const semanticClassifier = createSemanticClassifierFromEnv();

  const duplicates = detectDuplicates(items);
  const overlap = detectSemanticOverlap(items);
  const contradictions = detectContradictions(items);
  const discoverable = detectDiscoverable(items);

  const allFindings = [...duplicates, ...overlap, ...contradictions, ...discoverable];

  const recommendations: string[] = [];
  if (duplicates.length > 0) recommendations.push(`Consolidate ${duplicates.length} duplicate rule(s).`);
  if (contradictions.length > 0) recommendations.push(`Resolve ${contradictions.length} contradiction(s).`);
  if (overlap.length > 0) recommendations.push(`Review ${overlap.length} overlapping rule(s) for consolidation.`);
  if (discoverable.length > 0) recommendations.push(`Remove ${discoverable.length} instruction(s) describing discoverable facts.`);

  // Semantic review for ambiguous/high-value items using focused context.
  if (semanticClassifier) {
    const ambiguousCandidates = items
      .filter((item) => classify(item).confidence !== 'high')
      .slice(0, 8);
    const semanticResults = await Promise.all(
      ambiguousCandidates.map((item) =>
        classifyHybrid(item, { semanticClassifier, allItems: items, repoProfile: profile })
      )
    );
    const lowConfidence = semanticResults.filter((r) => r.confidence < 0.6);
    if (lowConfidence.length > 0) {
      recommendations.push(
        `Review ${lowConfidence.length} semantically ambiguous item(s) before making automatic changes.`
      );
    }
  }

  // Rough estimate of context reduction potential.
  const reducibleItems = duplicates.length + discoverable.length;
  const reductionPercent =
    items.length > 0 ? Math.round((reducibleItems / items.length) * 100) : 0;

  return {
    existingFiles,
    findings: allFindings,
    recommendations,
    estimatedContextReduction: reductionPercent,
  };
}

/**
 * classify — classify a single piece of knowledge and explain why.
 */
export async function classifyOne(content: string): Promise<string> {
  const semanticClassifier = createSemanticClassifierFromEnv();
  const result = await classifyHybrid(
    { content },
    { semanticClassifier, allItems: [{ content }] }
  );
  const lines = [
    `Classification: ${result.classification}`,
    `Confidence: ${result.confidence.toFixed(2)}`,
    `Source: ${result.source}`,
    '',
    `Reason: ${result.reason}`,
  ];
  if (result.suggestedPath) lines.push(`Suggested path: ${result.suggestedPath}`);
  if (result.suggestedPathGlob) lines.push(`Apply to: ${result.suggestedPathGlob}`);
  if (result.evidence.length > 0) {
    lines.push('');
    lines.push('Evidence:');
    for (const e of result.evidence.slice(0, 5)) lines.push(`  - ${e}`);
  }
  return lines.join('\n');
}

/**
 * improve — find and propose improvements to existing configuration.
 */
export async function improve(repoRoot: string): Promise<string> {
  const result = await audit(repoRoot);
  const lines: string[] = ['# Instruction Architect — Improvement Proposals\n'];

  if (result.findings.length === 0) {
    lines.push('No improvements needed. Configuration looks good.');
    return lines.join('\n');
  }

  for (let i = 0; i < result.findings.length; i++) {
    const f = result.findings[i];
    lines.push(`${i + 1}. **${f.type}**: ${f.description}`);
    lines.push(`   Recommendation: ${f.recommendation}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * review — full review of repository AI configuration.
 */
export async function review(repoRoot: string): Promise<string> {
  const result = await audit(repoRoot);
  const lines: string[] = ['# Instruction Architect — Configuration Review\n'];

  lines.push(`## Existing files (${result.existingFiles.length})`);
  for (const f of result.existingFiles) lines.push(`- ${f}`);
  lines.push('');

  lines.push(`## Findings (${result.findings.length})`);
  const grouped = new Map<string, number>();
  for (const f of result.findings) {
    grouped.set(f.type, (grouped.get(f.type) ?? 0) + 1);
  }
  for (const [type, count] of grouped) {
    lines.push(`- ${count} ${type.replace(/_/g, ' ')}(s)`);
  }
  lines.push('');

  lines.push('## Recommendations');
  for (const r of result.recommendations) lines.push(`- ${r}`);
  lines.push('');

  if (result.estimatedContextReduction !== undefined) {
    lines.push(`Estimated context reduction potential: ~${result.estimatedContextReduction}%`);
  }

  return lines.join('\n');
}
