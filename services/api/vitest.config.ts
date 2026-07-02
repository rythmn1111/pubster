import { defineConfig } from 'vitest/config';

/**
 * Tests run against the local `pubster` DB via `fastify.inject()` (no network,
 * no listening server). `NODE_ENV=test` silences the app logger + Prisma query
 * logs; tests share the DB so we run them serially to avoid interleaving.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: { NODE_ENV: 'test' },
    fileParallelism: false,
  },
});
