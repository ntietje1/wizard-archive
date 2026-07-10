import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const editorPackagePath = 'packages/editor'
const compareText = (left, right) => left.localeCompare(right)
const hostSingletonSpecifiers = ['react', 'react-dom', 'yjs']

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'))
}

function normalizedPath(filePath) {
  return path.normalize(filePath).split(path.sep).join('/')
}

function resolvePackagePath(root, packageRelativePath) {
  return normalizedPath(path.join(editorPackagePath, packageRelativePath))
}

function existingFile(root, relativePath) {
  const absolutePath = path.join(root, relativePath)
  return existsSync(absolutePath) && statSync(absolutePath).isFile()
}

function resolveRelativeImport(root, sourcePath, specifier) {
  const resolved = normalizedPath(path.join(path.dirname(sourcePath), specifier))
  const candidates = ['', '.js', '.mjs', '.css', '.d.ts', '/index.js', '/index.d.ts'].map(
    (suffix) => `${resolved}${suffix}`,
  )
  return candidates.find((candidate) => existingFile(root, candidate)) ?? resolved
}

function collectImports(sourcePath, source) {
  const sourceFile = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true)
  const specifiers = new Set()

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.add(node.moduleSpecifier.text)
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.add(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return Array.from(specifiers)
}

function exportedPackageFiles(packageJson) {
  return Object.values(packageJson.exports).flatMap((target) =>
    typeof target === 'string' ? [target] : [target.default, target.types],
  )
}

function collectPublicDependencyGraph(root, packageJson) {
  const dependencies = new Set()
  const externalSpecifiers = new Set()
  const nodeBuiltinSpecifiers = new Set()
  const outOfPackageRelativeImports = new Set()

  function visit(packageTarget) {
    const sourcePath = resolvePackagePath(root, packageTarget)
    if (dependencies.has(sourcePath) || !existingFile(root, sourcePath)) return
    dependencies.add(sourcePath)

    const source = readFileSync(path.join(root, sourcePath), 'utf8')
    for (const specifier of collectImports(sourcePath, source)) {
      if (specifier.startsWith('.')) {
        const resolved = resolveRelativeImport(root, sourcePath, specifier)
        if (resolved.startsWith(`${editorPackagePath}/`)) {
          visit(path.relative(editorPackagePath, resolved).split(path.sep).join('/'))
          continue
        }
        outOfPackageRelativeImports.add(`${sourcePath} -> ${specifier} (${resolved})`)
        continue
      }
      if (specifier.startsWith('node:')) {
        nodeBuiltinSpecifiers.add(specifier)
      } else {
        externalSpecifiers.add(specifier)
      }
    }
  }

  for (const packageTarget of exportedPackageFiles(packageJson)) visit(packageTarget)

  return {
    externalSpecifiers: Array.from(externalSpecifiers).sort(compareText),
    nodeBuiltinSpecifiers: Array.from(nodeBuiltinSpecifiers).sort(compareText),
    outOfPackageRelativeImports: Array.from(outOfPackageRelativeImports).sort(compareText),
  }
}

function isSourceExportTarget(target) {
  if (typeof target === 'string') return false
  return Object.entries(target).some(
    ([condition, exportTarget]) =>
      condition === 'source' ||
      (typeof exportTarget === 'string' && /^\.\/src\/.+\.(ts|tsx)$/.test(exportTarget)),
  )
}

function isMissingExportFile(root, target) {
  return !existingFile(root, resolvePackagePath(root, target))
}

function workspacePackageSpecifiers(packageJson) {
  return Object.entries({
    ...packageJson.dependencies,
    ...packageJson.peerDependencies,
  })
    .filter(([, version]) => typeof version === 'string' && version.startsWith('workspace:'))
    .map(([specifier]) => specifier)
    .sort(compareText)
}

function hostSingletonDependencySpecifiers(packageJson) {
  return hostSingletonSpecifiers
    .filter((specifier) => packageJson.dependencies?.[specifier] !== undefined)
    .sort(compareText)
}

function missingHostSingletonPeerSpecifiers(packageJson) {
  return hostSingletonSpecifiers
    .filter((specifier) => packageJson.peerDependencies?.[specifier] === undefined)
    .sort(compareText)
}

function packageNameForSpecifier(specifier) {
  const [first, second] = specifier.split('?', 1)[0].split('/')
  return first.startsWith('@') ? `${first}/${second}` : first
}

function undeclaredExternalSpecifiers(packageJson, externalSpecifiers) {
  const declaredPackages = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ])
  return externalSpecifiers
    .filter((specifier) => !declaredPackages.has(packageNameForSpecifier(specifier)))
    .sort(compareText)
}

function packageSpecifierForExport(subpath) {
  return subpath === '.' ? '@wizard-archive/editor' : `@wizard-archive/editor/${subpath.slice(2)}`
}

function canonicalPath(filePath) {
  return normalizedPath(realpathSync.native(filePath))
}

export function analyzeEditorSdkPortability(root = process.cwd()) {
  const packageJson = readJson(root, `${editorPackagePath}/package.json`)
  const tsconfig = readJson(root, `${editorPackagePath}/tsconfig.json`)
  const sourceOnlyExportTargets = Object.entries(packageJson.exports)
    .filter(([, target]) => isSourceExportTarget(target))
    .map(([subpath]) => subpath)
    .sort(compareText)
  const missingExportFiles = Array.from(new Set(exportedPackageFiles(packageJson)))
    .filter((target) => isMissingExportFile(root, target))
    .sort(compareText)
  const dependencyGraph = collectPublicDependencyGraph(root, packageJson)
  const externalSpecifiers = dependencyGraph.externalSpecifiers

  return {
    privatePackage: packageJson.private === true,
    noEmit: tsconfig.compilerOptions?.noEmit === true,
    allowImportingTsExtensions: tsconfig.compilerOptions?.allowImportingTsExtensions === true,
    sourceOnlyExportTargets,
    missingExportFiles,
    externalSpecifiers,
    nodeBuiltinSpecifiers: dependencyGraph.nodeBuiltinSpecifiers,
    undeclaredExternalSpecifiers: undeclaredExternalSpecifiers(packageJson, externalSpecifiers),
    privateWorkspaceExternalSpecifiers: externalSpecifiers.filter((specifier) =>
      specifier.startsWith('@wizard-archive/'),
    ),
    outOfPackageRelativeImports: dependencyGraph.outOfPackageRelativeImports,
    workspacePackageSpecifiers: workspacePackageSpecifiers(packageJson),
    hostSingletonDependencySpecifiers: hostSingletonDependencySpecifiers(packageJson),
    missingHostSingletonPeerSpecifiers: missingHostSingletonPeerSpecifiers(packageJson),
  }
}

export function validateEditorSdkPortability(root = process.cwd()) {
  const liabilities = analyzeEditorSdkPortability(root)
  const errors = []

  if (liabilities.privatePackage) errors.push('@wizard-archive/editor must be publishable.')
  if (liabilities.sourceOnlyExportTargets.length > 0) {
    errors.push(
      `Package exports still target source files: ${liabilities.sourceOnlyExportTargets.join(', ')}`,
    )
  }
  if (liabilities.missingExportFiles.length > 0) {
    errors.push(
      `Package exports point at missing files: ${liabilities.missingExportFiles.join(', ')}`,
    )
  }
  if (liabilities.outOfPackageRelativeImports.length > 0) {
    errors.push(
      [
        'Public package output imports files outside @wizard-archive/editor.',
        ...liabilities.outOfPackageRelativeImports,
      ].join('\n'),
    )
  }
  if (liabilities.nodeBuiltinSpecifiers.length > 0) {
    errors.push(
      `Public package output imports Node built-ins: ${liabilities.nodeBuiltinSpecifiers.join(', ')}`,
    )
  }
  if (liabilities.undeclaredExternalSpecifiers.length > 0) {
    errors.push(
      `Public package output imports undeclared dependencies: ${liabilities.undeclaredExternalSpecifiers.join(', ')}`,
    )
  }
  if (liabilities.privateWorkspaceExternalSpecifiers.length > 0) {
    errors.push(
      `Public package output imports private workspace packages: ${liabilities.privateWorkspaceExternalSpecifiers.join(', ')}`,
    )
  }
  if (liabilities.workspacePackageSpecifiers.length > 0) {
    errors.push(
      `Distributable dependencies still use workspace protocol: ${liabilities.workspacePackageSpecifiers.join(', ')}`,
    )
  }
  if (liabilities.hostSingletonDependencySpecifiers.length > 0) {
    errors.push(
      `Host singleton dependencies must be peers, not installable dependencies: ${liabilities.hostSingletonDependencySpecifiers.join(', ')}`,
    )
  }
  if (liabilities.missingHostSingletonPeerSpecifiers.length > 0) {
    errors.push(
      `Host singleton peer dependencies are missing: ${liabilities.missingHostSingletonPeerSpecifiers.join(', ')}`,
    )
  }

  return { errors, liabilities }
}

export async function validateBuiltEditorPackageImports(root = process.cwd()) {
  const packageJson = readJson(root, `${editorPackagePath}/package.json`)
  const resolveFromRoot = createRequire(path.join(root, 'package.json')).resolve
  const errors = []

  for (const [subpath, target] of Object.entries(packageJson.exports)) {
    const specifier = packageSpecifierForExport(subpath)
    const packageTarget = typeof target === 'string' ? target : target.default
    const expectedPath = path.resolve(root, editorPackagePath, packageTarget)
    let resolvedPath

    try {
      resolvedPath = resolveFromRoot(specifier)
    } catch (error) {
      errors.push(`Failed to resolve ${specifier}: ${error.message}`)
      continue
    }

    if (canonicalPath(resolvedPath) !== canonicalPath(expectedPath)) {
      errors.push(`${specifier} resolved to ${resolvedPath} instead of ${expectedPath}`)
      continue
    }

    if (typeof target === 'string') continue

    try {
      await import(pathToFileURL(resolvedPath).href)
    } catch (error) {
      errors.push(`Failed to import ${specifier}: ${error.message}`)
    }
  }

  return errors
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { errors, liabilities } = validateEditorSdkPortability()
  if (errors.length === 0) errors.push(...(await validateBuiltEditorPackageImports()))
  if (process.argv.includes('--json')) console.log(JSON.stringify(liabilities, null, 2))
  if (errors.length > 0) {
    console.error(errors.join('\n\n'))
    process.exitCode = 1
  }
}
