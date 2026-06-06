import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, relative, resolve } from 'node:path'

const repoRoot = process.cwd()
const PUBLIC_DEMO_ENTRY = 'src/routes/demo.tsx'

const AUTHENTICATED_APP_SERVICE_PATHS = [
  'src/features/campaigns',
  'src/features/context-menu',
  'src/features/dnd',
  'src/features/filesystem',
  'src/features/file-upload',
  'src/features/sidebar',
  'src/features/sharing',
  'src/shared/collaboration',
  'src/shared/hooks/useAuth',
  'src/shared/hooks/useAuthQuery',
  'src/shared/hooks/useCampaignQuery',
  'convex/_generated/api',
  'convex/_generated/server',
] as const

describe('public demo boundaries', () => {
  it('keeps public demo value imports free of authenticated app services', () => {
    const graph = collectValueImportGraph(PUBLIC_DEMO_ENTRY)
    const violations = graph.edges
      .filter(({ target }) => isAuthenticatedAppService(target))
      .map(({ importer, target }) => `${toRepoPath(importer)} -> ${toRepoPath(target)}`)

    expect(violations).toEqual([])
  })
})

function collectValueImportGraph(entryPath: string) {
  const entry = join(repoRoot, entryPath)
  const visited = new Set<string>()
  const edges: Array<{ importer: string; target: string }> = []
  const pending = [entry]

  while (pending.length > 0) {
    const importer = pending.pop()
    if (!importer || visited.has(importer)) continue
    visited.add(importer)

    for (const importPath of readValueImportPaths(readRepoFile(importer))) {
      const target = resolveImportPath(importPath, importer)
      if (!target) continue

      edges.push({ importer, target })
      if (!visited.has(target)) {
        pending.push(target)
      }
    }
  }

  return { edges }
}

function readRepoFile(path: string) {
  return readFileSync(path, 'utf8')
}

function readValueImportPaths(source: string) {
  return [
    ...Array.from(
      source.matchAll(/^\s*import\s+(?!type\b)(?:[\s\S]*?\s+from\s+)?['"`]([^'"`]+)['"`]/gm),
      (match) => match[1],
    ),
    ...Array.from(
      source.matchAll(/^\s*export\s+(?!type\b)(?:[\s\S]*?\s+from\s+)['"`]([^'"`]+)['"`]/gm),
      (match) => match[1],
    ),
    ...Array.from(source.matchAll(/import\(\s*['"`]([^'"`]+)['"`]\s*\)/g), (match) => match[1]),
  ]
}

function resolveImportPath(importPath: string, importer: string) {
  const candidate = resolveImportBasePath(importPath, importer)
  if (!candidate) return null

  return resolveExistingModulePath(candidate)
}

function resolveImportBasePath(importPath: string, importer: string) {
  if (importPath.startsWith('.')) {
    return resolve(dirname(importer), importPath)
  }

  if (importPath.startsWith('~/')) {
    return join(repoRoot, 'src', importPath.slice(2))
  }

  if (
    importPath.startsWith('src/') ||
    importPath.startsWith('shared/') ||
    importPath.startsWith('convex/')
  ) {
    return join(repoRoot, importPath)
  }

  return null
}

function resolveExistingModulePath(basePath: string) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    join(basePath, 'index.ts'),
    join(basePath, 'index.tsx'),
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function isAuthenticatedAppService(path: string) {
  const repoPath = toRepoPath(path)
  return AUTHENTICATED_APP_SERVICE_PATHS.some(
    (servicePath) => repoPath === servicePath || repoPath.startsWith(`${servicePath}/`),
  )
}

function toRepoPath(path: string) {
  return normalize(relative(repoRoot, path)).replaceAll('\\', '/')
}
