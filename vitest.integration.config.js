import { defineConfig } from 'vitest/config'

/**
 * Integration tests against a real (in-memory) MongoDB replica set.
 * Run with `npm run test:integration`. The first run downloads a mongod
 * binary (cached in ~/.cache/mongodb-binaries).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.js'],
    testTimeout: 60000,
    hookTimeout: 180000
  }
})
