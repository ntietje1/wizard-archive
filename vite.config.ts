import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite-plus'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { codecovVitePlugin } from '@codecov/vite-plugin'
import editorPackage from './packages/editor/package.json'

const editorDevelopmentAliases = [
  {
    find: /^@wizard-archive\/editor$/,
    replacement: editorSourcePath('index.ts'),
  },
]

const editorPackEntries = Object.entries(editorPackage.exports).flatMap(([subpath, target]) => {
  if (typeof target === 'string') return []

  const outputPath = target.default
  if (!outputPath.startsWith('./dist/') || !outputPath.endsWith('.mjs')) {
    throw new Error(`No built JavaScript target found for editor export ${subpath}`)
  }
  const sourceStem = outputPath.slice('./dist/'.length).replace(/\.mjs$/, '')
  const sourceEntry = [`${sourceStem}.ts`, `${sourceStem}.tsx`].find((candidate) =>
    existsSync(editorSourcePath(candidate)),
  )
  if (!sourceEntry) {
    throw new Error(`No package-owned source entry found for editor export ${subpath}`)
  }
  return [`packages/editor/src/${sourceEntry}`]
})

function editorSourcePath(sourcePath: string) {
  return fileURLToPath(new URL(`packages/editor/src/${sourcePath}`, import.meta.url))
}

export default defineConfig(({ command }) => ({
  pack: {
    entry: editorPackEntries,
    dts: true,
    deps: {
      skipNodeModulesBundle: true,
    },
    outDir: 'packages/editor/dist',
  },
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
      'LICENSE.md',
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
    alias: [
      ...(command === 'serve' ? editorDevelopmentAliases : []),
      {
        find: 'yjs',
        replacement: new URL('node_modules/yjs/dist/yjs.mjs', import.meta.url).pathname,
      },
    ],
    dedupe: ['yjs'],
  },
  optimizeDeps: {
    include: ['yjs'],
    exclude: ['@tanstack/router-devtools-core'],
  },
  ssr: {
    resolve: {},
    noExternal: ['@convex-dev/better-auth', '@wizard-archive/editor'],
  },
  envPrefix: ['VITE_'],
}))
