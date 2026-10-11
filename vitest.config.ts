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
    // Determinism tests simulate days of game time; give them room.
    testTimeout: 60_000,
  },
});
