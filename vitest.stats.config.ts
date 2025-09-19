import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// Dedicated config to run only the stats store tests in isolation.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/stores/__tests__/stats.api.test.ts'],
    exclude: [
      '**/tests/e2e/**',
      '**/node_modules/**',
    ],
  },
})
