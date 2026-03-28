//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    ignores: [
      '.output/**',
      '.nitro/**',
      'convex/_generated/**',
      'src/routeTree.gen.ts',
      'src/features/shadcn/**',
    ],
  },
  ...tanstackConfig,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-refresh/only-export-components': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'no-shadow': ['warn', { allow: ['_'] }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]
