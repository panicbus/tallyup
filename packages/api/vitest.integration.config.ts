import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api-integration',
    environment: 'node',
    include: ['**/*.integration.test.ts'],
    globalSetup: ['./src/test-support/global-setup.ts'],
    // DB-touching tests share one Postgres connection/transaction model —
    // run test files sequentially in one worker rather than in parallel.
    fileParallelism: false,
  },
});
