import { defineConfig, defaultExclude } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    exclude: [...defaultExclude, '**/*.integration.test.ts'],
  },
});
