import path from 'node:path'
import { defineConfig } from 'eslint/config'
import { includeIgnoreFile } from '@eslint/compat'
import tseslint from 'typescript-eslint'
import convexPlugin from '@convex-dev/eslint-plugin'

// TODO: remove this once oxlint has plugins API
export default defineConfig([
  includeIgnoreFile(path.resolve(import.meta.dirname, '.gitignore')),
  {
    ignores: ['convex/_generated/**'],
  },
  {
    files: ['convex/**/*.{ts,tsx}'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@convex-dev': convexPlugin,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@convex-dev/no-old-registered-function-syntax': 'error',
      '@convex-dev/require-args-validator': 'error',
      '@convex-dev/import-wrong-runtime': 'error',
      '@convex-dev/no-collect-in-query': 'warn',
      '@convex-dev/explicit-table-ids': 'error',
    },
  },
])
