#!/usr/bin/env tsx
/**
 * Instruction Architect CLI entry point.
 *
 * Usage: instruction-architect <command> [args]
 *
 * Commands:
 *   seed       Bootstrap/migrate/normalise AI configuration
 *   audit      Analyse without modifying
 *   improve    Find and propose improvements
 *   classify   Classify a piece of knowledge
 *   review     Full review of AI configuration
 *   configure  Manage personal preferences
 *   baseline   Inspect baseline information
 */
import { cwd } from 'node:process';
import { seed, audit, improve, classifyOne, review } from './commands/commands.js';
import { getBaseline } from './baseline/baseline.js';
import { loadState, saveState } from './state/state.js';

const [, , command, ...args] = process.argv;
const repoRoot = cwd();

async function main(): Promise<void> {
  switch (command) {
    case 'seed': {
      const output = await seed(repoRoot);
      console.log(output);
      break;
    }
    case 'audit': {
      const result = await audit(repoRoot);
      console.log('# Instruction Architect Audit\n');
      console.log(`Existing files: ${result.existingFiles.length}`);
      for (const f of result.existingFiles) console.log(`  ${f}`);
      console.log('');
      console.log(`Findings: ${result.findings.length}`);
      for (const f of result.findings) {
        console.log(`  [${f.type}] ${f.description}`);
        console.log(`    → ${f.recommendation}`);
      }
      console.log('');
      console.log('Recommendations:');
      for (const r of result.recommendations) console.log(`  - ${r}`);
      if (result.estimatedContextReduction !== undefined) {
        console.log(`\nEstimated context reduction: ~${result.estimatedContextReduction}%`);
      }
      break;
    }
    case 'improve': {
      const output = await improve(repoRoot);
      console.log(output);
      break;
    }
    case 'classify': {
      const content = args.join(' ');
      if (!content.trim()) {
        console.error('Usage: instruction-architect classify "<knowledge text>"');
        process.exit(1);
      }
      console.log(await classifyOne(content));
      break;
    }
    case 'review': {
      const output = await review(repoRoot);
      console.log(output);
      break;
    }
    case 'configure': {
      const state = await loadState();
      const [key, value] = args;
      if (!key) {
        console.log('Current preferences:');
        console.log(JSON.stringify(state.preferences, null, 2));
      } else if (key === 'language' || key === 'style' || key === 'autonomy') {
        (state.preferences as Record<string, string>)[key] = value;
        await saveState(state);
        console.log(`Set ${key} = ${value}`);
      } else {
        console.error(`Unknown preference: ${key}`);
        process.exit(1);
      }
      break;
    }
    case 'baseline': {
      const b = getBaseline();
      console.log(`Baseline version: ${b.version}\n`);
      console.log(b.globalInstructions);
      break;
    }
    default: {
      console.error(`Unknown command: ${command ?? '(none)'}`);
      console.error('Available commands: seed, audit, improve, classify, review, configure, baseline');
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
