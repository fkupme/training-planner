import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

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
    exclude: [
      '**/tests/e2e/**',
      '**/node_modules/**',
      'src/__tests__/**',
      'src/stores/__tests__/**',
      'src/services/__tests__/**',
      'src/composables/__tests__/usePlannerLogic.dayoffset.test.ts'
    ],
  },
})
