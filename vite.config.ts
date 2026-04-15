import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { devtools } from '@tanstack/devtools-vite'
import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { codecovVitePlugin } from '@codecov/vite-plugin'

export default defineConfig({
  lint: {
    plugins: ['oxc', 'typescript', 'unicorn', 'react', 'import'],
    categories: {
      correctness: 'warn',
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    ignorePatterns: [
      'LICENSE.md',
      '.output/**',
      '.nitro/**',
      'convex/_generated/**',
      'src/routeTree.gen.ts',
      'src/features/shadcn/**',
      '**/build/**',
      '**/coverage/**',
      '**/dist/**',
    ],
    rules: {
      'no-shadow': ['warn', { allow: ['_'] }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react/rules-of-hooks': 'error',
      'react/only-export-components': 'error',
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      'import/first': 'error',
      'import/no-commonjs': 'error',
      'import/no-duplicates': 'error',
      'typescript/array-type': ['error', { default: 'generic', readonly: 'generic' }],
      'typescript/ban-ts-comment': [
        'error',
        { 'ts-expect-error': false, 'ts-ignore': 'allow-with-description' },
      ],
      'typescript/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'typescript/no-unnecessary-condition': 'off',
      'typescript/prefer-for-of': 'warn',
      'typescript/require-await': 'warn',
    },
  },
  staged: {
    '*.{ts,tsx}': 'vp check --fix',
    '*.{js,mjs,cjs}': 'vp check --fix',
    '*.{json,css,md,yml,yaml}': 'vp fmt',
  },
  fmt: {
    semi: false,
    singleQuote: true,
    trailingComma: 'all',
    ignorePatterns: [
      '.nitro/',
      '.output/',
      '.tanstack/',
      '**/api',
      '**/build',
      '**/public',
      'convex/_generated/',
      'convex/README.md',
      'pnpm-lock.yaml',
      'routeTree.gen.ts',
    ],
  },
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    devtools(),
    tanstackStart(),
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    cloudflare({
      viteEnvironment: {
        name: 'ssr',
      },
    }),
    codecovVitePlugin({
      enableBundleAnalysis: !!process.env.CODECOV_TOKEN,
      bundleName: 'wizard-archive',
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      yjs: new URL('node_modules/yjs/dist/yjs.mjs', import.meta.url).pathname,
    },
    dedupe: ['yjs'],
  },
  optimizeDeps: {
    include: ['yjs'],
    exclude: ['@tanstack/router-devtools-core'],
  },
  ssr: {
    noExternal: ['@convex-dev/better-auth'],
  },
  envPrefix: ['VITE_'],
})
