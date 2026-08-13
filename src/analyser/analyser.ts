import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import type { KnowledgeItem, RepositoryProfile } from '../classifier/types.js';

/**
 * Source files that may contain existing AI configuration or useful knowledge.
 */
const SOURCE_FILES = [
  '.github/copilot-instructions.md',
  'AGENTS.md',
  'CLAUDE.md',
  '.cursor/rules',
];

const SOURCE_DIRS = [
  '.github/instructions',
  '.github/skills',
  '.github/prompts',
  '.github/agents',
];

/**
 * Extract knowledge items from a markdown file.
 *
 * Splits on H2/H3 sections and non-empty paragraphs so each logical unit
 * can be classified independently.
 */
export function extractKnowledgeFromMarkdown(
  content: string,
  sourceFile: string
): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];
  let extractedIndex = 0;

  // Extract the applyTo glob if present (instructions file front-matter).
  let pathGlob: string | undefined;
  const applyToMatch = content.match(/^---\s*\napplyTo:\s*['"]?([^'"\n]+)['"]?\s*\n---/m);
  if (applyToMatch) {
    pathGlob = applyToMatch[1].trim();
  }

  // Split on headings and blank lines to get individual rules/paragraphs.
  const sections = content
    .replace(/^---[\s\S]*?---\n/m, '') // strip front-matter
    .split(/\n#{2,3}\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const section of sections) {
    const lines = section.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    for (const line of lines) {
      const cleaned = line.replace(/^[-*•]\s+/, '').trim();
      if (cleaned.length > 10) {
        const id = `${sourceFile}:${extractedIndex}`;
        items.push({
          id,
          content: cleaned,
          sourceFile,
          sourceType: inferSourceType(sourceFile),
          pathGlob,
          scope: pathGlob ? 'path' : 'unknown',
          stability: 'medium',
          discoverability: 'low',
          behaviouralValue: 'medium',
          extractionConfidence: 0.9,
          rationale: 'Extracted from existing repository guidance source.',
        });
        extractedIndex++;
      }
    }
  }

  return items;
}

/**
 * Recursively find all markdown files in a directory.
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const s = await stat(full).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) {
      files.push(...(await findMarkdownFiles(full)));
    } else if (extname(entry) === '.md') {
      files.push(full);
    }
  }
  return files;
}

/**
 * Analyse a repository and extract all existing knowledge items from known
 * AI configuration sources.
 */
export async function analyseRepository(repoRoot: string): Promise<{
  items: KnowledgeItem[];
  existingFiles: string[];
  profile: RepositoryProfile;
}> {
  const items: KnowledgeItem[] = [];
  const existingFiles: string[] = [];

  // Read top-level source files.
  for (const rel of SOURCE_FILES) {
    const full = join(repoRoot, rel);
    let content: string;
    try {
      content = await readFile(full, 'utf8');
    } catch {
      continue;
    }
    existingFiles.push(rel);
    items.push(...extractKnowledgeFromMarkdown(content, rel));
  }

  // Read files from source directories.
  for (const rel of SOURCE_DIRS) {
    const full = join(repoRoot, rel);
    const files = await findMarkdownFiles(full);
    for (const file of files) {
      const content = await readFile(file, 'utf8').catch(() => null);
      if (!content) continue;
      const relPath = relative(repoRoot, file);
      existingFiles.push(relPath);
      items.push(...extractKnowledgeFromMarkdown(content, relPath));
    }
  }

  const profile = await buildRepositoryProfile(repoRoot, existingFiles);
  return { items, existingFiles, profile };
}

/**
 * Detect whether an instruction mentions facts that are already established
 * by repository source files (package manifests, CI, lockfiles, etc.).
 */
export async function detectSourceOfTruth(
  repoRoot: string,
  item: KnowledgeItem
): Promise<boolean> {
  const text = item.content.toLowerCase();

  const packageJsonPath = join(repoRoot, 'package.json');
  let pkg: Record<string, unknown> | null = null;
  try {
    pkg = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  } catch {
    // no package.json — that's fine
  }

  if (pkg) {
    const pkgManager = String(pkg.packageManager ?? '');
    if (pkgManager && text.includes(pkgManager.split('@')[0])) return true;
    const scripts = Object.keys((pkg.scripts as Record<string, unknown>) ?? {});
    if (scripts.some((s) => text.includes(s.toLowerCase()))) return true;
  }

  // Check for lockfiles.
  const lockfiles: Array<[string, string]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
    ['bun.lockb', 'bun'],
  ];
  for (const [file, manager] of lockfiles) {
    try {
      await stat(join(repoRoot, file));
      if (text.includes(manager)) return true;
    } catch {
      // not present
    }
  }

  return false;
}

function inferSourceType(sourceFile: string): KnowledgeItem['sourceType'] {
  if (sourceFile === '.github/copilot-instructions.md') return 'copilot';
  if (sourceFile.startsWith('.github/instructions/')) return 'instructions';
  if (sourceFile.startsWith('.github/skills/')) return 'skill';
  if (sourceFile.startsWith('.github/prompts/')) return 'prompt';
  if (sourceFile.startsWith('.github/agents/')) return 'agent';
  if (sourceFile === 'AGENTS.md' || sourceFile === 'CLAUDE.md' || sourceFile.startsWith('.cursor/rules')) {
    return 'external';
  }
  if (sourceFile.endsWith('.md')) return 'docs';
  return 'unknown';
}

async function buildRepositoryProfile(
  repoRoot: string,
  existingCopilotFiles: string[]
): Promise<RepositoryProfile> {
  const lockfileCandidates = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'bun.lock', 'bun.lockb'];
  const ciCandidates = ['.github/workflows/ci.yml', '.github/workflows/ci.yaml'];
  const testConfigCandidates = [
    'vitest.config.ts',
    'vitest.config.js',
    'jest.config.js',
    'jest.config.ts',
    'pytest.ini',
  ];

  const lockfiles: string[] = [];
  const ciFiles: string[] = [];
  const testConfigFiles: string[] = [];
  const sourceOfTruthFiles: string[] = [];

  for (const file of lockfileCandidates) {
    try {
      await stat(join(repoRoot, file));
      lockfiles.push(file);
      sourceOfTruthFiles.push(file);
    } catch {
      // ignored
    }
  }

  for (const file of ciCandidates) {
    try {
      await stat(join(repoRoot, file));
      ciFiles.push(file);
      sourceOfTruthFiles.push(file);
    } catch {
      // ignored
    }
  }

  for (const file of testConfigCandidates) {
    try {
      await stat(join(repoRoot, file));
      testConfigFiles.push(file);
      sourceOfTruthFiles.push(file);
    } catch {
      // ignored
    }
  }

  try {
    await stat(join(repoRoot, 'package.json'));
    sourceOfTruthFiles.push('package.json');
  } catch {
    // ignored
  }

  let packageManager: string | undefined;
  try {
    const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')) as {
      packageManager?: string;
    };
    packageManager = packageJson.packageManager?.split('@')[0];
  } catch {
    // ignored
  }
  if (!packageManager) {
    if (lockfiles.includes('pnpm-lock.yaml')) packageManager = 'pnpm';
    else if (lockfiles.includes('yarn.lock')) packageManager = 'yarn';
    else if (lockfiles.includes('bun.lock') || lockfiles.includes('bun.lockb')) packageManager = 'bun';
    else if (lockfiles.includes('package-lock.json')) packageManager = 'npm';
  }

  return {
    packageManager,
    lockfiles,
    hasCiWorkflow: ciFiles.length > 0,
    ciFiles,
    testConfigFiles,
    copilotFiles: existingCopilotFiles,
    sourceOfTruthFiles: Array.from(new Set(sourceOfTruthFiles)),
  };
}
