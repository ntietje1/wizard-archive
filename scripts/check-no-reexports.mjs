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

function hasExportModifier(node) {
  return ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
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

function exportedImportedAliasBindingViolation(filePath, source, ast, statement, importedAliases) {
  if (!ts.isExportDeclaration(statement)) return null
  if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) return null

  const exportedImportedAliases = statement.exportClause.elements.flatMap((element) => {
    const localName = exportedLocalName(element)
    const aliasText = importedAliases.get(localName)
    return aliasText ? [`${localName} = ${aliasText}`] : []
  })
  if (exportedImportedAliases.length === 0) return null

  return `${filePath}:${lineNumber(source, statement.getStart(ast))} exported imported alias: ${exportedImportedAliases.join(', ')}`
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

function defaultExportedImportedAliasViolation(filePath, source, ast, statement, importedAliases) {
  if (!ts.isExportAssignment(statement)) return null
  if (!ts.isIdentifier(statement.expression)) return null
  const aliasText = importedAliases.get(statement.expression.text)
  if (!aliasText) return null

  return `${filePath}:${lineNumber(source, statement.getStart(ast))} default-exported imported alias: ${statement.expression.text} = ${aliasText}`
}

function importedAliasText(node, importedBindings) {
  if (ts.isIdentifier(node)) {
    return importedBindings.has(node.text) ? node.text : null
  }

  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    return importedBindings.has(node.expression.text) ? node.getText() : null
  }

  return null
}

function importedTypeAliasText(node, importedBindings) {
  if (!ts.isTypeReferenceNode(node)) return null
  if (node.typeArguments && node.typeArguments.length > 0) return null
  const { typeName } = node

  if (ts.isIdentifier(typeName)) {
    return importedBindings.has(typeName.text) ? typeName.text : null
  }

  if (ts.isQualifiedName(typeName) && ts.isIdentifier(typeName.left)) {
    return importedBindings.has(typeName.left.text) ? typeName.getText() : null
  }

  return null
}

function importedValueAliasEntries(statement, importedBindings) {
  if (!ts.isVariableStatement(statement)) return []

  return statement.declarationList.declarations.flatMap((declaration) => {
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return []
    const aliasText = importedAliasText(declaration.initializer, importedBindings)
    return aliasText ? [[declaration.name.text, aliasText]] : []
  })
}

function importedTypeAliasEntry(statement, importedBindings) {
  if (!ts.isTypeAliasDeclaration(statement)) return null

  const aliasText = importedTypeAliasText(statement.type, importedBindings)
  return aliasText ? [statement.name.text, aliasText] : null
}

function collectImportedAliases(ast, importedBindings) {
  const importedAliases = new Map()
  for (const statement of ast.statements) {
    for (const [name, aliasText] of importedValueAliasEntries(statement, importedBindings)) {
      importedAliases.set(name, aliasText)
    }
    const typeAlias = importedTypeAliasEntry(statement, importedBindings)
    if (typeAlias) importedAliases.set(typeAlias[0], typeAlias[1])
  }
  return importedAliases
}

function exportedImportedValueAliases(statement, importedBindings) {
  if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) return []

  return importedValueAliasEntries(statement, importedBindings).map(
    ([name, aliasText]) => `${name} = ${aliasText}`,
  )
}

function exportedImportedTypeAlias(statement, importedBindings) {
  if (!ts.isTypeAliasDeclaration(statement) || !hasExportModifier(statement)) return null

  const typeAlias = importedTypeAliasEntry(statement, importedBindings)
  return typeAlias ? `${typeAlias[0]} = ${typeAlias[1]}` : null
}

function exportedImportedAliasViolation(filePath, source, ast, statement, importedBindings) {
  const valueAliases = exportedImportedValueAliases(statement, importedBindings)
  if (valueAliases.length > 0) {
    return `${filePath}:${lineNumber(source, statement.getStart(ast))} exported imported alias: ${valueAliases.join(', ')}`
  }

  const typeAlias = exportedImportedTypeAlias(statement, importedBindings)
  if (!typeAlias) return null

  return `${filePath}:${lineNumber(source, statement.getStart(ast))} exported imported alias: ${typeAlias}`
}

function importedHeritageAliasText(type, importedBindings) {
  return importedAliasText(type.expression, importedBindings)
}

function exportedImportedInterfaceProjectionViolation(
  filePath,
  source,
  ast,
  statement,
  importedBindings,
) {
  if (!ts.isInterfaceDeclaration(statement) || !hasExportModifier(statement)) return null
  if (statement.members.length > 0) return null

  const importedProjections = (statement.heritageClauses ?? []).flatMap((clause) =>
    clause.types.flatMap((type) => {
      const aliasText = importedHeritageAliasText(type, importedBindings)
      return aliasText ? [`${statement.name.text} = ${aliasText}`] : []
    }),
  )
  if (importedProjections.length === 0) return null

  return `${filePath}:${lineNumber(source, statement.getStart(ast))} exported imported interface projection: ${importedProjections.join(', ')}`
}

export function analyzeNoReexports(files) {
  const violations = []
  for (const { filePath, source } of files) {
    const ast = createAst(filePath, source)
    const importedBindings = collectImportedBindings(ast)
    const importedAliases = collectImportedAliases(ast, importedBindings)

    for (const statement of ast.statements) {
      const violation =
        reexportViolation(filePath, source, ast, statement) ??
        exportedImportedBindingViolation(filePath, source, ast, statement, importedBindings) ??
        exportedImportedAliasBindingViolation(filePath, source, ast, statement, importedAliases) ??
        defaultExportedImportedBindingViolation(
          filePath,
          source,
          ast,
          statement,
          importedBindings,
        ) ??
        defaultExportedImportedAliasViolation(filePath, source, ast, statement, importedAliases) ??
        exportedImportedAliasViolation(filePath, source, ast, statement, importedBindings) ??
        exportedImportedInterfaceProjectionViolation(
          filePath,
          source,
          ast,
          statement,
          importedBindings,
        )
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
