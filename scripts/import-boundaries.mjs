import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

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
const ignoredFiles = new Set(['src/routeTree.gen.ts'])
const ignoredPathPrefixes = ['convex/_generated/']
const packageConvexModules = new Set(['convex/react', 'convex/server', 'convex/values'])
const generatedConvexDataModel = 'convex/_generated/dataModel'
const generatedConvexApi = 'convex/_generated/api'
const editorPackageName = '@wizard-archive/editor'
const uiPackageName = '@wizard-archive/ui'
const editorPackageJson = JSON.parse(
  readFileSync(path.join(process.cwd(), 'packages/editor/package.json'), 'utf8'),
)
const publicEditorPackageSpecifiers = new Set(
  Object.keys(editorPackageJson.exports).map((subpath) =>
    subpath === '.' ? editorPackageName : `${editorPackageName}${subpath.slice(1)}`,
  ),
)

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

  for (const topLevelDir of ['shared', 'convex', 'src', 'packages']) {
    const dir = path.join(root, topLevelDir)
    if (!existsSync(dir)) continue
    collect(dir)
  }

  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

function isGeneratedApiDataBoundary(filePath) {
  return (
    filePath.startsWith('src/editor-adapters/') ||
    filePath.includes('/hooks/') ||
    filePath.includes('/runtime/') ||
    /(?:^|\/)use-[^/]+\.[cm]?[jt]sx?$/.test(filePath) ||
    filePath.includes('/__tests__/')
  )
}

function isGeneratedDataModelBoundary(filePath) {
  return (
    filePath.startsWith('src/editor-adapters/live/') ||
    filePath.startsWith('src/shared/uploads/') ||
    filePath.startsWith('src/features/settings/components/tabs/account-profile/') ||
    filePath.startsWith('src/test/') ||
    filePath.includes('/__tests__/')
  )
}

function isAllowedSrcConvexImport(filePath, specifier) {
  if (!specifier.startsWith('convex/')) return true
  if (packageConvexModules.has(specifier)) return true
  if (specifier === generatedConvexDataModel) return isGeneratedDataModelBoundary(filePath)
  if (specifier === generatedConvexApi) return isGeneratedApiDataBoundary(filePath)
  return false
}

function resolveWorkspaceSpecifierPath(filePath, specifier) {
  if (specifier.startsWith('~/')) {
    return path.posix.normalize(path.posix.join('src', specifier.slice(2)))
  }
  if (
    specifier.startsWith('src/') ||
    specifier.startsWith('shared/') ||
    specifier.startsWith('convex/') ||
    specifier.startsWith('packages/')
  ) {
    return path.posix.normalize(specifier)
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path.posix.normalize(path.posix.join(path.posix.dirname(filePath), specifier))
  }
  return null
}

function resolveBoundaryZone(filePath, specifier) {
  const resolvedPath = resolveWorkspaceSpecifierPath(filePath, specifier)
  if (resolvedPath) return resolveFileBoundaryZone(resolvedPath)

  if (specifier === editorPackageName || specifier.startsWith(`${editorPackageName}/`)) {
    return 'editor-package'
  }
  if (specifier === uiPackageName || specifier.startsWith(`${uiPackageName}/`)) {
    return 'ui-package'
  }
  return null
}

function resolveFileBoundaryZone(filePath) {
  if (filePath.startsWith('packages/editor/')) return 'editor-package'
  if (filePath.startsWith('packages/ui/')) return 'ui-package'
  return filePath.split('/')[0]
}

function importViolation(filePath, source, index, message) {
  return `${filePath}:${lineNumber(source, index)} ${message}`
}

function resolveRawPackageSourcePath(filePath, specifier, packagePath, packageName) {
  if (!specifier) return null
  if (specifier === packageName || specifier.startsWith(`${packageName}/`)) return null

  const resolvedPath = resolveWorkspaceSpecifierPath(filePath, specifier) ?? specifier

  const rawSourcePath = `${packagePath}/src`
  if (resolvedPath === rawSourcePath || resolvedPath.startsWith(`${rawSourcePath}/`)) {
    return resolvedPath
  }
  return null
}

function rawPackageSourceBoundaryViolation(
  filePath,
  source,
  index,
  specifier,
  kind,
  packagePath,
  packageLabel,
  packageName,
) {
  if (filePath.startsWith(`${packagePath}/`)) return null
  if (!resolveRawPackageSourcePath(filePath, specifier, packagePath, packageName)) return null
  const sourceZone = resolveFileBoundaryZone(filePath)
  return importViolation(
    filePath,
    source,
    index,
    `${sourceZone} may not import ${kind} from raw ${packageLabel} package source ${specifier}; use ${packageName} package exports`,
  )
}

function srcConvexImportViolation(filePath, source, index, specifier, kind) {
  if (specifier === generatedConvexApi) {
    return `${filePath}:${lineNumber(source, index)} src may import generated Convex API ${kind}s only from explicit data-boundary modules`
  }
  if (specifier === generatedConvexDataModel) {
    return `${filePath}:${lineNumber(source, index)} src may import generated Convex data-model ${kind}s only from explicit provider boundaries`
  }
  return `${filePath}:${lineNumber(source, index)} src may not import ${kind} from local Convex module ${specifier}`
}

function sharedBoundaryViolation(filePath, source, index, specifier, kind, sourceZone, targetZone) {
  if (sourceZone !== 'shared') return null
  if (specifier === `${editorPackageName}/resources/domain-id`) {
    return null
  }
  if (filePath.startsWith('shared/test/') && publicEditorPackageSpecifiers.has(specifier)) {
    return null
  }
  if (!['convex', 'src', 'editor-package', 'ui-package'].includes(targetZone)) return null
  return importViolation(
    filePath,
    source,
    index,
    `shared may not import ${kind} from ${targetZone} boundary module ${specifier}`,
  )
}

function convexBoundaryViolation(filePath, source, index, specifier, kind, sourceZone, targetZone) {
  if (sourceZone !== 'convex') return null
  if (targetZone === 'src' || targetZone === 'ui-package') {
    return importViolation(
      filePath,
      source,
      index,
      `convex may not import ${kind} from ${targetZone} boundary module ${specifier}`,
    )
  }
  return null
}

function editorPackageBoundaryViolation(
  filePath,
  source,
  index,
  specifier,
  kind,
  sourceZone,
  targetZone,
) {
  if (sourceZone !== 'editor-package') return null
  if (targetZone === 'convex' || targetZone === 'src') {
    return importViolation(
      filePath,
      source,
      index,
      `packages/editor may not import ${kind} from ${targetZone} boundary module ${specifier}`,
    )
  }
  return null
}

function editorAdapterBoundaryViolation(filePath, source, index, specifier, kind) {
  if (!filePath.startsWith('src/editor-adapters/')) return null
  if (specifier !== editorPackageName && !specifier.startsWith(`${editorPackageName}/`)) return null
  if (publicEditorPackageSpecifiers.has(specifier)) return null

  return importViolation(
    filePath,
    source,
    index,
    `src/editor-adapters may not import ${kind} from unapproved editor package subpath ${specifier}`,
  )
}

function uiPackageBoundaryViolation(
  filePath,
  source,
  index,
  specifier,
  kind,
  sourceZone,
  targetZone,
) {
  if (sourceZone !== 'ui-package') return null
  if (targetZone === 'convex' || targetZone === 'src') {
    return importViolation(
      filePath,
      source,
      index,
      `packages/ui may not import ${kind} from ${targetZone} boundary module ${specifier}`,
    )
  }
  if (targetZone === 'editor-package') {
    return importViolation(
      filePath,
      source,
      index,
      `packages/ui may not import ${kind} from editor-package boundary module ${specifier}`,
    )
  }
  return null
}

function localPackageBoundaryViolation(
  filePath,
  source,
  index,
  specifier,
  kind,
  sourceZone,
  targetZone,
) {
  if (
    (sourceZone === 'editor-package' || sourceZone === 'ui-package') &&
    targetZone === 'packages'
  ) {
    return importViolation(
      filePath,
      source,
      index,
      `${sourceZone} may not import ${kind} from another local package through ${specifier}`,
    )
  }
  return null
}

function boundaryViolation(filePath, source, index, specifier, kind) {
  const sourceZone = resolveFileBoundaryZone(filePath)
  const resolvedSpecifierPath = resolveWorkspaceSpecifierPath(filePath, specifier)
  const targetZone = resolveBoundaryZone(filePath, specifier)

  const violation =
    rawPackageSourceBoundaryViolation(
      filePath,
      source,
      index,
      specifier,
      kind,
      'packages/editor',
      'editor',
      editorPackageName,
    ) ??
    rawPackageSourceBoundaryViolation(
      filePath,
      source,
      index,
      specifier,
      kind,
      'packages/ui',
      'ui',
      uiPackageName,
    ) ??
    editorAdapterBoundaryViolation(filePath, source, index, specifier, kind) ??
    sharedBoundaryViolation(filePath, source, index, specifier, kind, sourceZone, targetZone) ??
    convexBoundaryViolation(filePath, source, index, specifier, kind, sourceZone, targetZone) ??
    editorPackageBoundaryViolation(
      filePath,
      source,
      index,
      specifier,
      kind,
      sourceZone,
      targetZone,
    ) ??
    uiPackageBoundaryViolation(filePath, source, index, specifier, kind, sourceZone, targetZone) ??
    localPackageBoundaryViolation(filePath, source, index, specifier, kind, sourceZone, targetZone)

  if (violation) return violation

  if (
    sourceZone === 'src' &&
    !isAllowedSrcConvexImport(filePath, resolvedSpecifierPath ?? specifier)
  ) {
    return srcConvexImportViolation(filePath, source, index, specifier, kind)
  }

  return null
}

function sourceFileKind(filePath) {
  switch (path.extname(filePath)) {
    case '.jsx':
      return ts.ScriptKind.JSX
    case '.tsx':
      return ts.ScriptKind.TSX
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS
    default:
      return ts.ScriptKind.TS
  }
}

function stringLiteralText(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null
}

function importTypeSpecifier(node) {
  return ts.isLiteralTypeNode(node.argument) ? stringLiteralText(node.argument.literal) : null
}

function collectImports(filePath, source) {
  const imports = []
  const ast = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourceFileKind(filePath),
  )

  function addImport(index, specifier, kind) {
    if (specifier) imports.push({ index, kind, specifier })
  }

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      addImport(
        node.getStart(ast),
        stringLiteralText(node.moduleSpecifier),
        node.importClause?.isTypeOnly ? 'type' : 'value',
      )
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addImport(
        node.getStart(ast),
        stringLiteralText(node.moduleReference.expression),
        node.isTypeOnly ? 'type' : 'value',
      )
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      addImport(node.getStart(ast), stringLiteralText(node.arguments[0]), 'value')
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'require') {
        addImport(node.getStart(ast), stringLiteralText(node.arguments[0]), 'value')
      }
    } else if (ts.isImportTypeNode(node)) {
      addImport(node.getStart(ast), importTypeSpecifier(node), 'type')
    }

    ts.forEachChild(node, visit)
  }

  visit(ast)
  return imports
}

export function analyzeImportBoundaries(files) {
  const violations = []

  for (const { filePath, source } of files) {
    for (const importExpression of collectImports(filePath, source)) {
      const violation = boundaryViolation(
        filePath,
        source,
        importExpression.index,
        importExpression.specifier,
        importExpression.kind,
      )
      if (violation) violations.push(violation)
    }
  }

  return Array.from(new Set(violations))
}

export function collectImportBoundarySources(root) {
  return collectWorkspaceFiles(root).map((filePath) => ({
    filePath: normalizedRelativePath(root, filePath),
    source: readFileSync(filePath, 'utf8'),
  }))
}
