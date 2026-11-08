import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      // /api/coingecko is served by the backend (rate limited + API key),
      // same as in production — no separate dev-only proxy.
      // Backend API proxy (catches all other /api/* routes)
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.js'],
    // Real-MongoDB tests run separately: npm run test:integration
    exclude: ['test/integration/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})
