import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
      'apps/web/src/**/*.test.{ts,tsx}',
      'scripts/**/*.test.ts',
    ],
    environment: 'node',
    // Determinism tests simulate days of game time; give them room. Parallel agent waves share
    // the machine, so the default allows for load (override with VITEST_TEST_TIMEOUT_MS).
    testTimeout: Number(process.env.VITEST_TEST_TIMEOUT_MS ?? 180_000),
  },
});
