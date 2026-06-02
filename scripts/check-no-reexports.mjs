import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = process.cwd()
const extensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.tsx', '.jsx', '.cts'])
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

function sourceFileKind(filePath) {
  const extension = path.extname(filePath)
  if (extension === '.jsx') return ts.ScriptKind.JSX
  if (extension === '.tsx') return ts.ScriptKind.TSX
  if (extension === '.js' || extension === '.mjs' || extension === '.cjs') return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function importedBindingNames(node) {
  const bindings = []
  const importClause = node.importClause
  if (!importClause) return bindings
  if (importClause.name) bindings.push(importClause.name.text)
  const namedBindings = importClause.namedBindings
  if (!namedBindings) return bindings
  if (ts.isNamespaceImport(namedBindings)) bindings.push(namedBindings.name.text)
  if (ts.isNamedImports(namedBindings)) {
    for (const element of namedBindings.elements) bindings.push(element.name.text)
  }
  return bindings
}

function exportedLocalName(element) {
  return (element.propertyName ?? element.name).text
}

function createAst(filePath, source) {
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourceFileKind(filePath),
  )
}

function collectImportedBindings(ast) {
  const importedBindings = new Set()
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    for (const binding of importedBindingNames(statement)) importedBindings.add(binding)
  }
  return importedBindings
}

function reexportViolation(filePath, source, ast, statement) {
  if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) return null
  const description = statement.exportClause ? 'named re-export' : 'export * re-export'
  return `${filePath}:${lineNumber(source, statement.getStart(ast))} ${description}`
}

function exportedImportedBindingViolation(filePath, source, ast, statement, importedBindings) {
  if (!ts.isExportDeclaration(statement)) return null
  if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) return null

  const exportedImportedBindings = statement.exportClause.elements
    .map(exportedLocalName)
    .filter((name) => importedBindings.has(name))
  if (exportedImportedBindings.length === 0) return null

  return `${filePath}:${lineNumber(source, statement.getStart(ast))} exported imported binding: ${exportedImportedBindings.join(', ')}`
}

function defaultExportedImportedBindingViolation(
  filePath,
  source,
  ast,
  statement,
  importedBindings,
) {
  if (!ts.isExportAssignment(statement)) return null
  if (!ts.isIdentifier(statement.expression)) return null
  if (!importedBindings.has(statement.expression.text)) return null

  return `${filePath}:${lineNumber(source, statement.getStart(ast))} default-exported imported binding: ${statement.expression.text}`
}

export function analyzeNoReexports(files) {
  const violations = []
  for (const { filePath, source } of files) {
    const ast = createAst(filePath, source)
    const importedBindings = collectImportedBindings(ast)

    for (const statement of ast.statements) {
      const violation =
        reexportViolation(filePath, source, ast, statement) ??
        exportedImportedBindingViolation(filePath, source, ast, statement, importedBindings) ??
        defaultExportedImportedBindingViolation(filePath, source, ast, statement, importedBindings)
      if (violation) violations.push(violation)
    }
  }
  return violations
}

function collectNoReexportSources() {
  return collectFiles(root).map((file) => ({
    filePath: path.relative(root, file),
    source: readFileSync(file, 'utf8'),
  }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const violations = analyzeNoReexports(collectNoReexportSources())
  if (violations.length > 0) {
    console.error('Re-exports are not allowed:')
    for (const violation of violations) console.error(`- ${violation}`)
    process.exit(1)
  }
}
