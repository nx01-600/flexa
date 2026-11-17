import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Every file talks to the same flexa_test database, and each one creates its own company fixtures.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Runs once per file, before it imports anything: pins the env to the test database.
    setupFiles: ['./test/setup.ts'],
    // Runs once per run: migrates and reseeds flexa_test.
    globalSetup: ['./test/global-setup.ts'],
  },
});
