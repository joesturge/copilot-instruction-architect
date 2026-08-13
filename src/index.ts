#!/usr/bin/env tsx
/**
 * Instruction Architect CLI entry point.
 *
 * Usage: instruction-architect <command> [args]
 *
 * Commands:
 *   seed       Show Copilot-native seeding guidance
 *   improve    Show Copilot-native improvement guidance
 *   review     List existing AI configuration files
 *   baseline   Inspect baseline information
 */
import { cwd } from 'node:process';
import { seed, improve, review } from './commands/commands.js';
import { getBaseline } from './baseline/baseline.js';

const [, , command] = process.argv;
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
    case 'baseline': {
      const b = getBaseline();
      console.log(`Baseline version: ${b.version}\n`);
      console.log(b.globalInstructions);
      break;
    }
    default: {
      console.error(`Unknown command: ${command ?? '(none)'}`);
      console.error('Available commands: seed, improve, review, baseline');
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
