import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['convex/production-entrypoints.test.ts'],
  },
})
