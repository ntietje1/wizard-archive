import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const editorPackagePath = path.join(process.cwd(), 'packages/editor/package.json')
const editorPackage = JSON.parse(readFileSync(editorPackagePath, 'utf8'))

const issue = 'WIZ-37'
const staleExportNamePattern = /(^FileSystem|SidebarItem|SIDEBAR_ITEM)/
const staleSubpathPattern = /^\.\/filesystem(?:\/|$)/
const staleDeclarationVocabularyPattern =
  /FileSystem\w*|SidebarItem\w*|SIDEBAR_ITEM\w*|AllPlayers\w*/g
const providerIdentityVocabularyPattern =
  /\b(?:SharedId|SessionRowId|WorkspaceMemberId|authUserId|storageId|_id)\b|\bId\s*</g

const expectedStaleExportBaseline = [].sort(compareStrings)

const expectedStaleSubpathBaseline = [].sort(compareStrings)
const expectedStaleDeclarationBaseline = [].sort(compareStrings)
const expectedProviderIdentityBaseline = [].sort(compareStrings)

const actualStaleExports = []
for (const [subpath, target] of Object.entries(editorPackage.exports)) {
  if (typeof target === 'string') continue
  for (const exportName of sourceExports(sourcePathForExportTarget(target))) {
    if (staleExportNamePattern.test(exportName)) {
      actualStaleExports.push(`${subpath}:${exportName}`)
    }
  }
}
actualStaleExports.sort(compareStrings)

const actualStaleSubpaths = Object.keys(editorPackage.exports)
  .filter((subpath) => staleSubpathPattern.test(subpath))
  .sort(compareStrings)

const actualStaleDeclarations = editorPackage.wizardArchive.backendSafeSubpaths
  .filter((subpath) => subpath.startsWith('./resources/'))
  .flatMap((subpath) =>
    declarationBodiesForExport(subpath).flatMap((source) =>
      Array.from(new Set(source.match(staleDeclarationVocabularyPattern) ?? [])).map(
        (name) => `${subpath}:${name}`,
      ),
    ),
  )
  .sort(compareStrings)
const actualProviderIdentityDeclarations = Object.keys(editorPackage.exports)
  .flatMap((subpath) =>
    declarationBodiesForExport(subpath).flatMap((source) =>
      Array.from(new Set(source.match(providerIdentityVocabularyPattern) ?? [])).map(
        (name) => `${subpath}:${name}`,
      ),
    ),
  )
  .sort(compareStrings)

const failures = [
  ...compareBaseline('stale public export names', expectedStaleExportBaseline, actualStaleExports),
  ...compareBaseline('stale public subpaths', expectedStaleSubpathBaseline, actualStaleSubpaths),
  ...compareBaseline(
    'stale public resource declaration vocabulary',
    expectedStaleDeclarationBaseline,
    actualStaleDeclarations,
  ),
  ...compareBaseline(
    'provider identity vocabulary in public declarations',
    expectedProviderIdentityBaseline,
    actualProviderIdentityDeclarations,
  ),
]

if (failures.length > 0) {
  console.error(`${issue} editor SDK vocabulary baseline changed.`)
  console.error(
    'This check may only shrink the stale SidebarItem/FileSystem public vocabulary baseline. ' +
      'Migrate the API to resource/document/command terms, then update this baseline.',
  )
  for (const failure of failures) console.error(failure)
  process.exit(1)
}

console.log(
  `${issue} editor SDK vocabulary baseline held: ` +
    `${actualStaleExports.length} stale public exports, ` +
    `${actualStaleSubpaths.length} stale filesystem subpaths, ` +
    `${actualStaleDeclarations.length} stale resource declaration terms, ` +
    `${actualProviderIdentityDeclarations.length} provider identity terms.`,
)

function declarationBodiesForExport(subpath) {
  const target = editorPackage.exports[subpath]
  if (typeof target === 'string') return []
  const entryPath = sourcePathForExportTarget(target)
  const entrySource = readFileSync(entryPath, 'utf8')
  const ast = createSourceFile(entryPath, entrySource)
  const hasDeclarationBody = ast.statements.some(
    (statement) => !ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement),
  )
  if (hasDeclarationBody) return [entrySource]

  const implementationSources = Array.from(
    entrySource.matchAll(/from ["'](?<specifier>\.[^"']+\.mjs)["']/g),
    (match) => match.groups.specifier,
  ).map((specifier) => {
    const implementationPath = path.resolve(
      path.dirname(entryPath),
      specifier.replace(/\.mjs$/, '.d.mts'),
    )
    return readFileSync(implementationPath, 'utf8')
  })
  return [entrySource, ...implementationSources]
}

function sourcePathForExportTarget(target) {
  return path.join(process.cwd(), 'packages/editor', target.types)
}

function sourceExports(sourcePath) {
  const source = readFileSync(sourcePath, 'utf8')
  const ast = createSourceFile(sourcePath, source)

  const exports = []

  for (const statement of ast.statements) {
    exports.push(...statementExportNames(statement))
  }

  return exports.sort(compareStrings)
}

function createSourceFile(sourcePath, source) {
  return ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

function statementExportNames(statement) {
  if (ts.isExportDeclaration(statement)) return exportDeclarationNames(statement)
  if (!hasExportModifier(statement)) return []
  if (isNamedExportableDeclaration(statement)) return statement.name ? [statement.name.text] : []
  if (ts.isVariableStatement(statement)) return variableExportNames(statement)
  return []
}

function exportDeclarationNames(statement) {
  if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) return []
  return statement.exportClause.elements.map((element) => element.name.text)
}

function hasExportModifier(statement) {
  return (
    ts.canHaveModifiers(statement) &&
    Boolean(
      ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
    )
  )
}

function isNamedExportableDeclaration(statement) {
  return (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement)
  )
}

function variableExportNames(statement) {
  return statement.declarationList.declarations
    .map((declaration) => declaration.name)
    .filter(ts.isIdentifier)
    .map((identifier) => identifier.text)
}

function compareBaseline(label, expected, actual) {
  const expectedSet = new Set(expected)
  const actualSet = new Set(actual)
  const added = actual.filter((entry) => !expectedSet.has(entry))
  const removed = expected.filter((entry) => !actualSet.has(entry))
  const baselineFailures = []
  if (added.length > 0) {
    baselineFailures.push(`${label} expanded:\n${added.map(prefixListItem).join('\n')}`)
  }
  if (removed.length > 0) {
    baselineFailures.push(
      `${label} baseline can shrink after confirming migration:\n${removed
        .map(prefixListItem)
        .join('\n')}`,
    )
  }
  return baselineFailures
}

function prefixListItem(value) {
  return `  - ${value}`
}

function compareStrings(left, right) {
  return left.localeCompare(right)
}
