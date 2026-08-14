import { defineConfig } from 'vitest/config'

/**
 * Database / RLS integration tests.
 *
 * These run against the LOCAL Supabase stack (`pnpm db:start`). They are kept in a
 * separate project from the unit suite because they require Docker, a real Postgres
 * and real JWTs — they are integration evidence, not unit evidence.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    hookTimeout: 60_000,
    testTimeout: 60_000,
    fileParallelism: false,
  },
})
