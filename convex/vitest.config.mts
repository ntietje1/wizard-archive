import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    include: ['convex/**/__tests__/**/*.test.ts'],
    setupFiles: ['convex/_test/setup.helper.ts'],
    server: {
      deps: {
        inline: ['convex-test'],
      },
    },
  },
})
