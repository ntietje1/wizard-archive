import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'packages/editor/src/__tests__/editor-sdk-portability.test.ts',
      'packages/editor/src/__tests__/public-api-shape.test.ts',
    ],
  },
})
