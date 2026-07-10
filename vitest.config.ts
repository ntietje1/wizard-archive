import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'packages/*/src/**/__tests__/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'packages/editor/src/__tests__/editor-sdk-portability.test.ts',
      'packages/editor/src/__tests__/public-api-shape.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/features/**', 'src/shared/**'],
      exclude: ['src/features/shadcn/**'],
    },
  },
})
