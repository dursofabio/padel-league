import { defineConfig } from 'vitest/config';

/** Database tests (plain PostgreSQL + Supabase stub): `npm run test:db`. */
export default defineConfig({
  test: {
    include: ['supabase/tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
