#!/usr/bin/env tsx
/**
 * Instruction Architect CLI entry point.
 *
 * Usage: instruction-architect <command> [args]
 *
 * Commands:
 *   seed       Bootstrap/migrate/normalise AI configuration
 *   improve    Propose improvements to existing configuration
 *   review     List existing AI configuration files
 *   configure  Manage personal preferences
 *   baseline   Inspect baseline information
 */
import { cwd } from 'node:process';
import { seed, improve, review } from './commands/commands.js';
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
    case 'improve': {
      const output = await improve(repoRoot);
      console.log(output);
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
      console.error('Available commands: seed, improve, review, configure, baseline');
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
