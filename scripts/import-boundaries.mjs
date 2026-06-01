import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const extensions = new Set(['.ts', '.tsx'])
const ignoredSegments = new Set([
  'node_modules',
  '.git',
  '.codex',
  '.claude',
  '.output',
  '.nitro',
  '.playwright-mcp',
  '.tanstack',
  '.vite-hooks',
  '.vscode',
  '.wrangler',
  'coverage',
  'dist',
  'output',
  'playwright-report',
  'test-results',
])
const ignoredFiles = new Set(['src/routeTree.gen.ts'])
const ignoredPathPrefixes = ['convex/_generated/']
const packageConvexModules = new Set(['convex/react', 'convex/server', 'convex/values'])
const generatedConvexPrefixes = ['convex/_generated/']
const blockedP01ContractPrefixes = [
  'convex/errors',
  'convex/storage/validation',
  'convex/links',
  'convex/permissions',
  'convex/editors/types',
  'convex/userPreferences/types',
  'convex/sidebarItems/filesystem',
  'convex/sidebarItems/validation/parent',
  'convex/sidebarItems/functions/defaultItemName',
]
const legacyDtoTypeModules = new Set([
  'convex/blocks/functions/searchBlocks',
  'convex/campaigns/types',
  'convex/canvases/types',
  'convex/editHistory/types',
  'convex/files/types',
  'convex/folders/types',
  'convex/gameMaps/types',
  'convex/notes/types',
  'convex/sessions/types',
  'convex/sidebarItems/types/types',
  'convex/sidebarShares/types',
  'convex/users/types',
  'convex/yjsSync/functions/types',
])

function normalizedRelativePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/')
}

function isIgnored(root, filePath) {
  const relativeFile = normalizedRelativePath(root, filePath)
  if (ignoredFiles.has(relativeFile)) return true
  if (ignoredPathPrefixes.some((prefix) => relativeFile.startsWith(prefix))) return true
  const relativeParts = relativeFile.split('/')
  return relativeParts.some((part) => ignoredSegments.has(part))
}

function collectWorkspaceFiles(root) {
  const files = []

  function collect(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (isIgnored(root, fullPath)) continue
      if (entry.isDirectory()) {
        collect(fullPath)
        continue
      }
      if (extensions.has(path.extname(entry.name))) files.push(fullPath)
    }
  }

  for (const topLevelDir of ['shared', 'convex', 'src']) {
    const dir = path.join(root, topLevelDir)
    collect(dir)
  }

  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

function isBlockedP01Contract(specifier) {
  return blockedP01ContractPrefixes.some(
    (prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`),
  )
}

function isAllowedSrcConvexImport(specifier, kind) {
  if (!specifier.startsWith('convex/')) return true
  if (packageConvexModules.has(specifier)) return true
  if (generatedConvexPrefixes.some((prefix) => specifier.startsWith(prefix))) return true
  if (isBlockedP01Contract(specifier)) return false
  return kind === 'type' && legacyDtoTypeModules.has(specifier)
}

function classifyStaticImport(importDeclaration) {
  return importDeclaration.trimStart().startsWith('import type ') ? 'type' : 'value'
}

function resolveBoundaryZone(filePath, specifier) {
  if (specifier.startsWith('~/')) return 'src'
  if (specifier.startsWith('src/')) return 'src'
  if (specifier.startsWith('shared/')) return 'shared'
  if (specifier.startsWith('convex/')) return 'convex'
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path.posix
      .normalize(path.posix.join(path.posix.dirname(filePath), specifier))
      .split('/')[0]
  }
  return null
}

function importViolation(filePath, source, index, message) {
  return `${filePath}:${lineNumber(source, index)} ${message}`
}

function srcConvexImportViolation(filePath, source, index, specifier, kind) {
  return `${filePath}:${lineNumber(source, index)} src may not import ${kind} from local Convex module ${specifier}`
}

function boundaryViolation(filePath, source, index, specifier, kind) {
  const sourceZone = filePath.split('/')[0]
  const targetZone = resolveBoundaryZone(filePath, specifier)

  if (sourceZone === 'shared' && (targetZone === 'convex' || targetZone === 'src')) {
    return importViolation(
      filePath,
      source,
      index,
      `shared may not import ${kind} from ${targetZone} boundary module ${specifier}`,
    )
  }

  if (sourceZone === 'convex' && targetZone === 'src') {
    return importViolation(
      filePath,
      source,
      index,
      `convex may not import ${kind} from src boundary module ${specifier}`,
    )
  }

  if (sourceZone === 'src' && !isAllowedSrcConvexImport(specifier, kind)) {
    return srcConvexImportViolation(filePath, source, index, specifier, kind)
  }

  return null
}

export function analyzeImportBoundaries(files) {
  const violations = []

  for (const { filePath, source } of files) {
    for (const match of source.matchAll(
      /(^|[\r\n])(\s*import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"])/g,
    )) {
      const specifier = match[3]
      const kind = classifyStaticImport(match[0])
      const violation = boundaryViolation(
        filePath,
        source,
        match.index + match[1].length,
        specifier,
        kind,
      )
      if (violation) violations.push(violation)
    }

    for (const match of source.matchAll(/(^|[\r\n])(\s*import\s*\(\s*['"]([^'"]+)['"]\s*\))/g)) {
      const specifier = match[3]
      const violation = boundaryViolation(
        filePath,
        source,
        match.index + match[1].length,
        specifier,
        'value',
      )
      if (violation) violations.push(violation)
    }
  }

  return violations
}

export function collectImportBoundarySources(root) {
  return collectWorkspaceFiles(root).map((filePath) => ({
    filePath: normalizedRelativePath(root, filePath),
    source: readFileSync(filePath, 'utf8'),
  }))
}
