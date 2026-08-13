import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/evals/**/*.eval.ts'],
    environment: 'node',
  },
});
