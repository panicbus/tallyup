import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/shared',
      'packages/web',
      'packages/api',
      'packages/api/vitest.integration.config.ts',
    ],
  },
});
