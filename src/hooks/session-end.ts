/**
 * Session end hook — analyse accumulated observations and persist learning.
 *
 * Defers expensive analysis until the session is complete to avoid
 * interrupting development flow.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadState } from '../state/state.js';
import { createSemanticClassifierFromEnv } from '../classifier/llm.js';
import { evaluateConversationKnowledge, groupRepresentationDecisions } from '../knowledge/pipeline.js';
import type { RepresentationBuckets } from '../knowledge/pipeline.js';
import {
  formatInstructions,
  readGlobalInstructions,
  writeGlobalInstructions,
  writePathInstruction,
  writePrompt,
  writeSkill,
} from '../io/writer.js';

async function main(): Promise<void> {
  const state = await loadState();
  if (state.preferences.autonomy === 'disabled') return;

  const recentObservations = state.observations.filter((o) => {
    const age = Date.now() - new Date(o.timestamp).getTime();
    return age < 24 * 60 * 60 * 1000; // last 24 hours
  });
  if (recentObservations.length === 0) return;

  const semanticClassifier = createSemanticClassifierFromEnv();
  const latest = [...recentObservations].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  const repoRoot = latest?.repoRoot;
  if (!repoRoot) return;
  const repoObservations = recentObservations.filter((o) => o.repoRoot === repoRoot);

  const evaluated = await evaluateConversationKnowledge(repoRoot, repoObservations, {
    semanticClassifier,
  });
  if (evaluated.decisions.length === 0) return;
  const grouped = groupRepresentationDecisions(evaluated.decisions);
  const kept = evaluated.decisions.filter((decision) => decision.shouldPersist);
  if (kept.length === 0) return;

  if (state.preferences.autonomy === 'automatic') {
    const touched = await applyConversationLearning(repoRoot, grouped);
    if (touched.length === 0) return;
    console.log('\nInstruction Architect — Session knowledge applied:\n');
    for (const file of touched) {
      console.log(`  ✓ ${file}`);
    }
    return;
  }

  console.log('\nInstruction Architect — Session knowledge proposals:\n');
  for (const decision of kept.slice(0, 12)) {
    console.log(`  [${decision.semantic.classification}] ${decision.item.content}`);
  }
  console.log('');
  console.log(`  Keep: ${kept.length}`);
  console.log(`  Drop: ${grouped.dropped.length}`);
  if (grouped.path.size > 0) console.log(`  Path-scoped groups: ${grouped.path.size}`);
  if (grouped.skills.length > 0) console.log(`  Skill candidates: ${grouped.skills.length}`);
  if (grouped.prompts.length > 0) console.log(`  Prompt candidates: ${grouped.prompts.length}`);
  if (grouped.global.length > 0) console.log(`  Global candidates: ${grouped.global.length}`);

  console.log('\nSet `instruction-architect configure autonomy automatic` to apply these proposals at session end.');
}

main().catch(() => {
  // Hooks must never crash the session.
});

async function applyConversationLearning(
  repoRoot: string,
  grouped: RepresentationBuckets
): Promise<string[]> {
  const touched: string[] = [];

  const globalItems = grouped.global.map((d) => d.item.content);
  if (globalItems.length > 0) {
    const existing = await readGlobalInstructions(repoRoot);
    const merged = appendUniqueBulletSection(existing, 'Conversation-learned guidance', globalItems);
    if (merged !== existing) {
      await writeGlobalInstructions(repoRoot, merged);
      touched.push('.github/copilot-instructions.md');
    }
  }

  for (const [glob, bucket] of grouped.path.entries()) {
    const name = `conversation-${slugify(glob)}`;
    const file = `.github/instructions/${name}.instructions.md`;
    const existing = await readUtf8(join(repoRoot, file));
    const existingBody = stripFrontMatter(existing);
    const existingApplyTo = extractApplyTo(existing);
    const next = appendUniqueBulletSection(
      existingBody,
      'Conversation-learned guidance',
      bucket.map((d) => d.item.content),
    );
    if (next !== existingBody || (existingApplyTo !== undefined && existingApplyTo !== glob)) {
      await writePathInstruction(repoRoot, name, glob, next);
      touched.push(file);
    }
  }

  if (grouped.skills.length > 0) {
    const file = '.github/skills/conversation-workflows/SKILL.md';
    const existing = await readUtf8(join(repoRoot, file));
    const next = appendUniqueBulletSection(
      existing,
      'Conversation-learned workflows',
      grouped.skills.map((d) => d.item.content),
    );
    if (next !== existing) {
      await writeSkill(repoRoot, 'conversation-workflows', next);
      touched.push(file);
    }
  }

  if (grouped.prompts.length > 0) {
    const file = '.github/prompts/conversation-operations.prompt.md';
    const existing = await readUtf8(join(repoRoot, file));
    const next = appendUniqueBulletSection(
      existing,
      'Conversation-learned operations',
      grouped.prompts.map((d) => d.item.content),
    );
    if (next !== existing) {
      await writePrompt(repoRoot, 'conversation-operations', next);
      touched.push(file);
    }
  }

  return touched;
}

function appendUniqueBulletSection(existing: string, heading: string, lines: string[]): string {
  const trimmed = existing.trimEnd();
  const existingBullets = new Set(
    existing
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2).trim())
  );
  const unique = lines.filter((line) => !existingBullets.has(line.trim()));
  if (unique.length === 0) return existing;
  const section = formatInstructions(
    heading,
    unique.map((content) => ({ content }))
  );
  return trimmed ? `${trimmed}\n\n${section}` : section;
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, 40) || 'repository-guidance';
}

function stripFrontMatter(content: string): string {
  return content.replace(/^---[\s\S]*?---\n*/, '');
}

function extractApplyTo(content: string): string | undefined {
  const match = content.match(/^---\s*\napplyTo:\s*['"]?([^'"\n]+)['"]?\s*\n---/);
  return match?.[1]?.trim();
}

async function readUtf8(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}
