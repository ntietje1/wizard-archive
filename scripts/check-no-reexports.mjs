import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const extensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.tsx'])
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
const ignoredPathParts = [
  ['convex', '_generated'],
  ['src', 'routeTree.gen.ts'],
]

function isIgnored(filePath) {
  const relativeParts = path.relative(root, filePath).split(path.sep)
  if (relativeParts.some((part) => ignoredSegments.has(part))) return true
  return ignoredPathParts.some((parts) =>
    parts.every((part, index) => relativeParts[index] === part),
  )
}

function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (isIgnored(fullPath)) continue
    if (entry.isDirectory()) {
      collectFiles(fullPath, files)
      continue
    }
    if (extensions.has(path.extname(entry.name))) files.push(fullPath)
  }
  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

function parseImportBindings(importDeclaration) {
  const bindings = new Set()
  const namespaceMatch = importDeclaration.match(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)/)
  if (namespaceMatch) bindings.add(namespaceMatch[1])

  const defaultMatch = importDeclaration.match(/import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/)
  if (defaultMatch && defaultMatch[1] !== 'type') bindings.add(defaultMatch[1])

  const namedMatch = importDeclaration.match(/\{([\s\S]*?)\}/)
  if (!namedMatch) return bindings

  for (const rawSpecifier of namedMatch[1].split(',')) {
    const specifier = rawSpecifier.trim().replace(/^type\s+/, '')
    if (!specifier) continue
    const aliasMatch = specifier.match(/\bas\s+([A-Za-z_$][\w$]*)$/)
    if (aliasMatch) {
      bindings.add(aliasMatch[1])
      continue
    }
    const importedName = specifier.match(/^([A-Za-z_$][\w$]*)/)
    if (importedName) bindings.add(importedName[1])
  }

  return bindings
}

function exportedBindingNames(exportDeclaration) {
  const names = []
  const namedMatch = exportDeclaration.match(/\{([\s\S]*?)\}/)
  if (!namedMatch) return names
  for (const rawSpecifier of namedMatch[1].split(',')) {
    const specifier = rawSpecifier.trim().replace(/^type\s+/, '')
    if (!specifier) continue
    const localName = specifier.match(/^([A-Za-z_$][\w$]*)/)
    if (localName) names.push(localName[1])
  }
  return names
}

const violations = []

for (const file of collectFiles(root)) {
  const source = readFileSync(file, 'utf8')
  const relativeFile = path.relative(root, file)

  for (const match of source.matchAll(/\bexport\s+\*\s+from\s+['"][^'"]+['"]/g)) {
    violations.push(`${relativeFile}:${lineNumber(source, match.index)} export * re-export`)
  }

  for (const match of source.matchAll(
    /\bexport\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+['"][^'"]+['"]/g,
  )) {
    violations.push(`${relativeFile}:${lineNumber(source, match.index)} named re-export`)
  }

  const importedBindings = new Set()
  for (const match of source.matchAll(/\bimport\s+(?:type\s+)?[\s\S]*?\s+from\s+['"][^'"]+['"]/g)) {
    for (const binding of parseImportBindings(match[0])) importedBindings.add(binding)
  }

  for (const match of source.matchAll(/\bexport\s+(?:type\s+)?\{[\s\S]*?\}(?!\s+from)/g)) {
    const exportedImportedBindings = exportedBindingNames(match[0]).filter((name) =>
      importedBindings.has(name),
    )
    if (exportedImportedBindings.length > 0) {
      violations.push(
        `${relativeFile}:${lineNumber(source, match.index)} exported imported binding: ${exportedImportedBindings.join(', ')}`,
      )
    }
  }

  for (const match of source.matchAll(/\bexport\s+default\s+([A-Za-z_$][\w$]*)\s*(?:;|$)/gm)) {
    if (importedBindings.has(match[1])) {
      violations.push(
        `${relativeFile}:${lineNumber(source, match.index)} default-exported imported binding: ${match[1]}`,
      )
    }
  }
}

if (violations.length > 0) {
  console.error('Re-exports are not allowed:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}
