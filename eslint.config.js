//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: [
      '.output/**',
      '.nitro/**',
      'convex/_generated/**',
      'src/routeTree.gen.ts',
      'src/components/shadcn/**',
      'src/hooks/shadcn/**',
    ],
  },
  ...tanstackConfig,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
