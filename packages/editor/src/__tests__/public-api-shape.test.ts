import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const compareText = (left: string, right: string) => left.localeCompare(right)

const publicApiShape = {
  publishableStableApi: ['.', './adapter'],
  backendSchemaLeafContracts: readEditorPackage().wizardArchive.backendSafeSubpaths,
  stableAdapterContracts: ['./collaboration/yjs-provider', './runtime', './sharing'],
  packageAssets: ['./style.css'],
  temporaryAdapterConstructionContracts: [],
} as const

function sortedPublicApiExports() {
  const editorPackage = readEditorPackage()
  return Object.keys(editorPackage.exports).sort()
}

function sortedPublicCodeExports() {
  const editorPackage = readEditorPackage()
  return Object.entries(editorPackage.exports)
    .filter(([, target]) => typeof target !== 'string')
    .map(([subpath]) => subpath)
    .sort()
}

function sortedClassifiedExports() {
  return Object.values(publicApiShape).flat().sort()
}

function sortedAdapterContractSubpaths() {
  return [
    ...publicApiShape.stableAdapterContracts,
    ...publicApiShape.temporaryAdapterConstructionContracts,
  ].sort()
}

function sourceFileKind(sourcePath: string) {
  switch (path.extname(sourcePath)) {
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

function createSourceAst(sourcePath: string, source: string) {
  return ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourceFileKind(sourcePath),
  )
}

function interfaceMemberNames(sourcePath: string, source: string, interfaceName: string) {
  const ast = createSourceAst(sourcePath, source)
  const memberNames: Array<string> = []

  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      for (const member of node.members) {
        if (member.name && ts.isIdentifier(member.name)) {
          memberNames.push(member.name.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(ast)
  return memberNames.sort(compareText)
}

function stringLiteralText(node: ts.Node | undefined) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null
}

function importTypeSpecifier(node: ts.ImportTypeNode) {
  return ts.isLiteralTypeNode(node.argument) ? stringLiteralText(node.argument.literal) : null
}

function collectImportSpecifiers(sourcePath: string, source: string) {
  const imports: Array<string> = []
  const ast = createSourceAst(sourcePath, source)

  function addImport(specifier: string | null) {
    if (specifier) imports.push(specifier)
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      addImport(stringLiteralText(node.moduleSpecifier))
    } else if (ts.isExportDeclaration(node)) {
      addImport(stringLiteralText(node.moduleSpecifier))
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      addImport(stringLiteralText(node.arguments[0]))
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'require') {
        addImport(stringLiteralText(node.arguments[0]))
      }
    } else if (ts.isImportTypeNode(node)) {
      addImport(importTypeSpecifier(node))
    }

    ts.forEachChild(node, visit)
  }

  visit(ast)
  return imports
}

function sortedSourceExports(sourcePath: string) {
  const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')
  const ast = createSourceAst(sourcePath, source)
  const exports: Array<string> = []

  for (const statement of ast.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        exports.push(...statement.exportClause.elements.map((element) => element.name.text))
      }
      continue
    }
    if (ts.isExportAssignment(statement)) {
      exports.push('default')
      continue
    }
    if (
      !ts.canHaveModifiers(statement) ||
      !ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      continue
    }
    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
    ) {
      if (statement.name) exports.push(statement.name.text)
      continue
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) exports.push(declaration.name.text)
      }
    }
  }

  return exports.sort()
}

function sortedRootExports() {
  return sortedSourceExports('packages/editor/src/index.ts')
}

function sortedAdapterExports() {
  return sortedSourceExports('packages/editor/src/adapter.ts')
}

function sortedSharingExports() {
  return sortedSourceExports('packages/editor/src/sharing/contracts.ts')
}

function sortedResourceOperationCapabilityExports() {
  return sortedSourceExports('packages/editor/src/filesystem/domain/operation-capabilities.ts')
}

function sortedWorkspaceItemsExports() {
  return sortedSourceExports('packages/editor/src/workspace/items.ts')
}

function sortedHistoryContractExports() {
  return sortedSourceExports('packages/editor/src/filesystem/history-contract.ts')
}

function sortedYjsProviderExports() {
  return sortedSourceExports('packages/editor/src/collaboration/yjs-provider.ts')
}

function declarationTextForExport(subpath: string) {
  const target = readEditorPackage().exports[subpath]
  if (typeof target === 'string') throw new Error(`${subpath} is not a code export`)
  return readFileSync(path.join(process.cwd(), 'packages/editor', target.types), 'utf8')
}

function declarationImplementationTextForExport(subpath: string) {
  const declaration = declarationTextForExport(subpath)
  const reexportMatch = declaration.match(/from "\.\/([^"]+)\.mjs"/)
  if (!reexportMatch) return declaration

  return readFileSync(
    path.join(process.cwd(), 'packages/editor/dist', `${reexportMatch[1]}.d.mts`),
    'utf8',
  )
}

function patchContractSource() {
  return readFileSync(
    path.join(process.cwd(), 'packages/editor/src/filesystem/patch-contract.ts'),
    'utf8',
  )
}

function sourcePathForExport(subpath: string) {
  if (subpath === '.') return path.join('packages/editor', 'src/index.ts')

  const exportTarget = readEditorPackage().exports[subpath]
  if (typeof exportTarget === 'string') throw new Error(`${subpath} is not a code export`)
  const outputPath = exportTarget.default
  const sourceBasePath = outputPath.replace('./dist/', 'src/').replace(/\.mjs$/, '')
  const sourceCandidates = [
    `${sourceBasePath}.ts`,
    `${sourceBasePath}.tsx`,
    `${sourceBasePath}/index.ts`,
  ]
  const sourcePath = sourceCandidates.find((candidate) =>
    existsSync(path.join(process.cwd(), 'packages/editor', candidate)),
  )
  expect(sourcePath).toBeDefined()
  return path.join('packages/editor', sourcePath!)
}

function readEditorPackage() {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), 'packages/editor/package.json'), 'utf8'),
  ) as {
    exports: Record<string, string | { default: string; types: string }>
    wizardArchive: { backendSafeSubpaths: Array<string> }
  }
}

function packageSpecifierForExport(subpath: string) {
  return subpath === '.' ? '@wizard-archive/editor' : `@wizard-archive/editor/${subpath.slice(2)}`
}

function normalizedPath(filePath: string) {
  return path.normalize(filePath).split(path.sep).join('/')
}

function collectRelativeEditorDependencies(sourcePath: string, seen = new Set<string>()) {
  const normalizedSourcePath = sourcePath.split(path.sep).join('/')
  if (seen.has(normalizedSourcePath)) return seen
  seen.add(normalizedSourcePath)

  const source = readFileSync(path.join(process.cwd(), normalizedSourcePath), 'utf8')
  const importSpecifiers = collectImportSpecifiers(normalizedSourcePath, source)

  for (const specifier of importSpecifiers) {
    if (!specifier.startsWith('.')) continue
    const resolved = path
      .normalize(path.join(path.dirname(normalizedSourcePath), specifier))
      .split(path.sep)
      .join('/')
    const candidates = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(
      (suffix) => `${resolved}${suffix}`,
    )
    const dependencyPath = candidates.find(sourceExists)
    if (dependencyPath?.startsWith('packages/editor/src/')) {
      collectRelativeEditorDependencies(dependencyPath, seen)
    }
  }

  return seen
}

function unsafeBackendDependencySpecifiers(sourcePath: string, source: string) {
  return collectImportSpecifiers(sourcePath, source).filter(
    (specifier) =>
      specifier === 'react' ||
      specifier.startsWith('react-dom') ||
      specifier.startsWith('@blocknote/react') ||
      specifier.startsWith('@blocknote/shadcn') ||
      specifier.startsWith('convex/') ||
      specifier.startsWith('~/') ||
      specifier.startsWith('src/'),
  )
}

function sourceExists(sourcePath: string) {
  try {
    readFileSync(path.join(process.cwd(), sourcePath), 'utf8')
    return true
  } catch {
    return false
  }
}

describe('editor package public API shape', () => {
  it('classifies every exported package subpath by final API role', () => {
    expect(sortedPublicApiExports()).toEqual(sortedClassifiedExports())
  })

  it('classifies non-root package subpaths by explicit stability decision', () => {
    expect(publicApiShape).not.toHaveProperty('adapterConstructionContracts')
    expect(publicApiShape).toHaveProperty('stableAdapterContracts')
    expect(publicApiShape).toHaveProperty('temporaryAdapterConstructionContracts')
    expect(publicApiShape.temporaryAdapterConstructionContracts).toEqual([])
  })

  it('keeps transition-era workspace subpaths out of the public SDK surface', () => {
    const exports = sortedPublicApiExports()

    expect(exports.filter((subpath) => subpath.startsWith('./workspace/'))).toEqual([])
    expect(exports).not.toEqual(
      expect.arrayContaining([
        './canvas/workspace-session-source',
        './notes/workspace-session-source',
        './workspace/runtime',
      ]),
    )
  })

  it('keeps internal resource implementation leaves out of the public SDK surface', () => {
    expect(sortedPublicApiExports()).not.toEqual(
      expect.arrayContaining([
        './collaboration/yjs-session',
        './notes/use-collaboration-playback',
        './resources/catalog-links',
        './resources/history',
        './resources/history-types',
        './sharing/block/projection',
        './sharing/sidebar-items/projection',
      ]),
    )
  })

  it('keeps every export map target package-owned and consumer-resolvable', () => {
    const editorPackage = readEditorPackage()

    for (const [subpath, target] of Object.entries(editorPackage.exports)) {
      if (typeof target === 'string') {
        expect(subpath).toBe('./style.css')
        expect(target).toBe('./dist/style.css')
        const targetPath = path.join(process.cwd(), 'packages/editor', target)
        expect(existsSync(targetPath)).toBe(true)
        expect(normalizedPath(require.resolve(packageSpecifierForExport(subpath)))).toBe(
          normalizedPath(targetPath),
        )
        continue
      }

      expect(Object.keys(target).sort()).toEqual(['default', 'types'])
      expect(target.default).toMatch(/^\.\/dist\/.+\.mjs$/)
      expect(target.types).toBe(target.default.replace(/\.mjs$/, '.d.mts'))

      const targetPath = path.join(process.cwd(), 'packages/editor', target.default)
      const typesPath = path.join(process.cwd(), 'packages/editor', target.types)
      expect(existsSync(targetPath)).toBe(true)
      expect(existsSync(typesPath)).toBe(true)
      expect(existsSync(path.join(process.cwd(), sourcePathForExport(subpath)))).toBe(true)
      expect(normalizedPath(require.resolve(packageSpecifierForExport(subpath)))).toBe(
        normalizedPath(targetPath),
      )
    }
  })

  it('keeps extracted package subpaths classified by final API role', () => {
    expect(sortedAdapterContractSubpaths()).not.toContain('./resources/operation-adapter')
    expect(publicApiShape.backendSchemaLeafContracts).toContain('./files/import-contract')
    expect(publicApiShape.backendSchemaLeafContracts).toContain('./resources/items')
    expect(publicApiShape.backendSchemaLeafContracts).not.toContain('./workspace/runtime')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './canvas/session-source',
    )
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './notes/session-source',
    )
  })

  it('keeps public resource command constants source-neutral', () => {
    const source = readFileSync(path.join(process.cwd(), 'packages/editor/src/adapter.ts'), 'utf8')
    const commandTypes = source.slice(
      source.indexOf('export const WIZARD_EDITOR_RESOURCE_COMMAND_TYPE'),
      source.indexOf('export const WIZARD_EDITOR_RESOURCE_EVENT_TYPE'),
    )

    expect(commandTypes).toContain('setResourceAudiencePermission')
    expect(commandTypes).toContain('setResourcesMemberPermission')
    expect(commandTypes).toContain('clearResourcesMemberPermission')
    expect(commandTypes).not.toMatch(/Player|SidebarItem/)
  })

  it('keeps app-level test fixtures from pinning workspace item extraction subpaths', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/test/factories/sidebar-item-factory.ts'),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/resources/items')
    expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/resource-contract')
    expect(source).not.toContain('@wizard-archive/editor/files/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/game-maps/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/notes/item-contract')
    expect(source).toContain('@wizard-archive/editor/adapter')
  })

  it('keeps editor package test fixtures on canonical campaign identity', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/test/sidebar-item-factory.ts'),
      'utf8',
    )

    expect(source).toContain('shared/test/campaign-id')
    expect(source).not.toContain('ResourceWorkspaceId')
  })

  it('keeps live runtime file replacement on adapter-owned item predicates', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-runtime.ts'),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
    expect(source).not.toContain('@wizard-archive/editor/sharing')
  })

  it('keeps live share mutation runner on local command results', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/sharing/use-share-mutation-runner.ts'),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/sharing')
  })

  it('keeps adapter contract tests on adapter-owned item types', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/__tests__/wizard-editor-adapter.test.ts'),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/files/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/notes/item-contract')
    expect(source).toContain('@wizard-archive/editor/adapter')
  })

  it('keeps preview upload construction on the adapter facade', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/previews/use-claim-and-upload-preview.ts'),
      'utf8',
    )

    expect(sortedPublicApiExports()).not.toContain('./files/preview-upload-contract')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './files/preview-upload-contract',
    )
    expect(source).not.toContain('@wizard-archive/editor/files/preview-upload-contract')
    expect(source).toContain('@wizard-archive/editor/adapter')
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining(['WizardEditorPreviewUpload', 'WizardEditorPreviewUploadResult']),
    )
  })

  it('keeps file session construction on the adapter facade', () => {
    const liveFileSessionSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/files/session-source.ts'),
      'utf8',
    )
    const livePdfPreviewSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/previews/use-pdf-preview-upload.ts'),
      'utf8',
    )
    const liveRuntimeTestSource = readFileSync(
      path.join(
        process.cwd(),
        'src/editor-adapters/live/__tests__/use-live-workspace-runtime.test.tsx',
      ),
      'utf8',
    )
    const localOperationUtilsSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-operation-utils.ts'),
      'utf8',
    )

    expect(sortedPublicApiExports()).not.toContain('./files/session-contract')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './files/session-contract',
    )
    for (const source of [
      liveFileSessionSource,
      livePdfPreviewSource,
      liveRuntimeTestSource,
      localOperationUtilsSource,
    ]) {
      expect(source).not.toContain('@wizard-archive/editor/files/session-contract')
      expect(source).not.toContain('@wizard-archive/editor/files/import-contract')
      expect(source).not.toContain('@wizard-archive/editor/files/item-contract')
    }
    expect(liveFileSessionSource).toContain('@wizard-archive/editor/adapter')
    expect(livePdfPreviewSource).toContain('@wizard-archive/editor/adapter')
    expect(liveRuntimeTestSource).toContain('@wizard-archive/editor/adapter')
    expect(localOperationUtilsSource).toContain('@wizard-archive/editor/adapter')
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining([
        'WizardEditorFileSession',
        'WizardEditorFileSessionReplaceInput',
        'WizardEditorResolvedFile',
      ]),
    )
    expect(declarationTextForExport('./adapter')).not.toContain('./files/session-contract')
  })

  it('keeps note Yjs persistence construction on the adapter facade', () => {
    const liveNoteYjsSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/notes/yjs-collaboration.ts'),
      'utf8',
    )

    expect(sortedPublicApiExports()).not.toContain('./notes/yjs-persistence')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './notes/yjs-persistence',
    )
    expect(liveNoteYjsSource).not.toContain('@wizard-archive/editor/notes/yjs-persistence')
    expect(liveNoteYjsSource).not.toContain('persistedCampaignId')
    expect(liveNoteYjsSource).toContain(
      'sourceId: assertDomainId(DOMAIN_ID_KIND.campaign, persistedSourceId)',
    )
    expect(liveNoteYjsSource).toContain('@wizard-archive/editor/adapter')
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining([
        'useWizardEditorNoteYjsPersistenceLifecycle',
        'WizardEditorNoteYjsBeforeDestroyState',
        'WizardEditorNoteYjsPersistenceAdapter',
        'WizardEditorNoteYjsPersistenceSession',
      ]),
    )
    expect(declarationTextForExport('./adapter')).not.toContain('./notes/yjs-persistence')
  })

  it('keeps note collaboration provider construction on the collaboration contract', () => {
    const inMemoryNoteSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/in-memory-note-session-source.ts'),
      'utf8',
    )

    expect(sortedPublicApiExports()).not.toContain('./notes/collaboration-contract')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './notes/collaboration-contract',
    )
    expect(inMemoryNoteSource).not.toContain('@wizard-archive/editor/notes/collaboration-contract')
    expect(inMemoryNoteSource).toContain('@wizard-archive/editor/adapter')
    expect(inMemoryNoteSource).toContain('@wizard-archive/editor/collaboration/yjs-provider')
    expect(sortedAdapterExports()).not.toContain('WizardEditorNoteCollaborationEngineProvider')
    expect(declarationTextForExport('./adapter')).not.toContain(
      'WizardEditorNoteCollaborationEngineProvider',
    )
    expect(declarationTextForExport('./adapter')).not.toContain('./notes/collaboration-contract')
  })

  it('keeps game map session construction on the adapter facade', () => {
    const adapterConsumers = [
      'src/editor-adapters/live/game-maps/session-source.ts',
      'src/editor-adapters/local/local-game-map-session-source.ts',
    ]

    expect(sortedPublicApiExports()).not.toContain('./game-maps/session-contract')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './game-maps/session-contract',
    )

    for (const sourcePath of adapterConsumers) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/game-maps/session-contract')
      expect(source).not.toContain('@wizard-archive/editor/game-maps/document-contract')
      expect(source).not.toContain('@wizard-archive/editor/game-maps/item-contract')
      expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
      expect(source).not.toContain('@wizard-archive/editor/resources/transaction-contract')
      expect(source).not.toContain('completedResourceOperation')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining([
        'WizardEditorMapPinCreationRequest',
        'WizardEditorMapPinCreationsInput',
        'WizardEditorMapSession',
        'completeWizardEditorMapPinOperation',
        'hasWizardEditorGameMapPin',
        'isWizardEditorGameMapItem',
        'planWizardEditorMapPinCreations',
        'readWizardEditorGameMapPinnedItemIds',
      ]),
    )
    expect(declarationTextForExport('./adapter')).not.toContain('./game-maps/session-contract')
  })

  it('keeps local workspace model document construction on the adapter facade', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-workspace-model.ts'),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/canvas/document-contract')
    expect(source).not.toContain('@wizard-archive/editor/game-maps/document-contract')
    expect(source).not.toContain('@wizard-archive/editor/notes/document-contract')
    expect(source).not.toContain('@wizard-archive/editor/notes/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/resource-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
    expect(source).toContain('workspaceId: CampaignId')
    expect(source).toContain('@wizard-archive/editor/adapter')
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining([
        'WizardEditorEmbeddedCanvasState',
        'WizardEditorNoteCollaborationSessionRequest',
        'planWizardEditorMapPinCreations',
      ]),
    )
  })

  it('keeps local filesystem snapshot document construction on the adapter facade', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-filesystem-snapshot.ts'),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/canvas/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/files/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/game-maps/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/notes/document-contract')
    expect(source).not.toContain('@wizard-archive/editor/notes/imported-text')
    expect(source).not.toContain('@wizard-archive/editor/notes/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/resource-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
    expect(source).not.toContain('convex/_generated/dataModel')
    expect(source).not.toMatch(/\bId<'campaigns'>/)
    expect(source).toContain('CampaignId')
    expect(source).toContain('@wizard-archive/editor/adapter')
    expect(sortedAdapterExports()).toContain('createWizardEditorPlainTextNoteContent')
  })

  it('keeps local filesystem snapshot tests on the adapter facade', () => {
    const sourcePaths = [
      'src/editor-adapters/local/__tests__/local-file-session-source.test.tsx',
      'src/editor-adapters/local/__tests__/local-filesystem-snapshot.test.ts',
    ]

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/game-maps/item-contract')
      expect(source).not.toContain('@wizard-archive/editor/notes/document-contract')
      expect(source).not.toContain('@wizard-archive/editor/notes/item-contract')
      expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
  })

  it('keeps local workspace runtime tests on the adapter facade', () => {
    const sourcePaths = [
      'src/editor-adapters/local/__tests__/local-sidebar-workspace-source.test.ts',
      'src/editor-adapters/local/__tests__/local-workspace-runtime.test.ts',
    ]

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/notes/item-contract')
      expect(source).not.toContain('@wizard-archive/editor/resources/resource-contract')
      expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
  })

  it('keeps local file session tests on the adapter facade', () => {
    const sourcePaths = [
      'src/editor-adapters/local/__tests__/local-file-session-source.test.tsx',
      'src/editor-adapters/local/__tests__/helpers/import-file.ts',
    ]

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/files/import-contract')
      expect(source).not.toContain('@wizard-archive/editor/files/item-contract')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
  })

  it('keeps local game map session tests on the adapter facade', () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        'src/editor-adapters/local/__tests__/local-game-map-session-source.test.ts',
      ),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/files/import-contract')
    expect(source).not.toContain('@wizard-archive/editor/game-maps/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/notes/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/resource-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
    expect(source).toContain('@wizard-archive/editor/adapter')
  })

  it('keeps local canvas session tests on the adapter facade', () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        'src/editor-adapters/local/__tests__/in-memory-canvas-session-source.test.tsx',
      ),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/canvas/document-contract')
    expect(source).not.toContain('@wizard-archive/editor/canvas/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/resource-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
    expect(source).toContain('@wizard-archive/editor/adapter')
  })

  it('keeps local canvas session source workspace-shaped', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/in-memory-canvas-session-source.ts'),
      'utf8',
    )

    expect(source).not.toContain('CampaignId')
    expect(source).not.toContain('workspaceId: CampaignId')
    expect(source).toContain('workspaceId: string')
  })

  it('keeps live canvas session campaign identity domain-owned', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/canvas/session-source.ts'),
      'utf8',
    )
    const runtimeSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-runtime.ts'),
      'utf8',
    )

    expect(source).not.toContain('convex/_generated/dataModel')
    expect(source).not.toContain('as CampaignId')
    expect(source).toContain('workspaceId: CampaignId')
    expect(runtimeSource).toContain('useLiveCanvasSessionSource({\n    workspaceId,')
    expect(runtimeSource).toContain('useLiveCanvasEmbeddedSessionSource({\n    workspaceId,')
  })

  it('keeps live note session campaign identity domain-owned', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/notes/session-source.ts'),
      'utf8',
    )
    const runtimeSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-runtime.ts'),
      'utf8',
    )

    expect(source).not.toContain('convex/_generated/dataModel')
    expect(source).not.toContain('as CampaignId')
    expect(source).toContain('workspaceId: CampaignId')
    expect(runtimeSource).toContain('useLiveNoteSessionPorts({\n    workspaceId,')
  })

  it('keeps live filesystem campaign identity domain-owned', () => {
    const hostSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/filesystem/host.tsx'),
      'utf8',
    )
    const downloadSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/filesystem/download.ts'),
      'utf8',
    )
    const providerSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/live-workspace-runtime-provider.tsx'),
      'utf8',
    )
    const runtimeSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-runtime.ts'),
      'utf8',
    )

    expect(hostSource).not.toContain('convex/_generated/dataModel')
    expect(hostSource).toContain('workspaceId: CampaignId')
    expect(downloadSource).not.toContain('asLiveDownloadCampaignId')
    expect(downloadSource).not.toContain('convex/_generated/dataModel')
    expect(downloadSource).not.toMatch(/\bas Id</)
    expect(downloadSource).toContain('workspaceId: CampaignId')
    expect(providerSource).not.toContain(
      "workspaceId: NonNullable<ReturnType<typeof useCampaign>['campaignId']>",
    )
    expect(providerSource).toContain('const { campaign, campaignId }')
    expect(providerSource).not.toContain('campaignSlug')
    expect(providerSource).not.toContain('dmUsername')
    expect(providerSource).toContain('workspaceId: CampaignId')
    expect(providerSource).toContain('campaignId: workspaceId')
    expect(providerSource).toContain('useLiveFileSystemRuntime(\n    workspaceId,')
    expect(runtimeSource).toContain('createLiveWorkspaceDownloadSource(convex, workspaceId,')
  })

  it('keeps live workspace runtime campaign identity domain-owned', () => {
    const runtimeSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-runtime.ts'),
      'utf8',
    )

    expect(runtimeSource).not.toContain('type LiveWorkspaceId')
    expect(runtimeSource).not.toContain("NonNullable<LiveCampaign['campaignId']>")
    expect(runtimeSource).not.toContain('as CampaignId')
    expect(runtimeSource).toContain('workspaceId: CampaignId')
  })

  it('keeps local workspace runtime adapter tests on the adapter facade', () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        'src/editor-adapters/local/__tests__/local-workspace-runtime-adapter.test.ts',
      ),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/files/import-contract')
    expect(source).not.toContain('@wizard-archive/editor/files/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/game-maps/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/notes/document-contract')
    expect(source).not.toContain('@wizard-archive/editor/notes/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/resource-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
    expect(source).toContain('@wizard-archive/editor/adapter')
  })

  it('keeps live file and game map session tests on the adapter facade', () => {
    const sourcePaths = [
      'src/editor-adapters/live/files/__tests__/session-source.test.tsx',
      'src/editor-adapters/live/game-maps/__tests__/session-source.test.tsx',
    ]

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/files/import-contract')
      expect(source).not.toContain('@wizard-archive/editor/files/item-contract')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
  })

  it('keeps live workspace runtime tests on the adapter facade', () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        'src/editor-adapters/live/__tests__/use-live-workspace-runtime.test.tsx',
      ),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/notes/document-contract')
    expect(source).not.toContain('@wizard-archive/editor/notes/item-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/resource-contract')
    expect(source).not.toContain('@wizard-archive/editor/resources/transaction-contract')
    expect(source).toContain('@wizard-archive/editor/adapter')
  })

  it('keeps live filesystem transaction receipt consumers on the adapter facade', () => {
    const sourcePaths = [
      'src/editor-adapters/live/filesystem/host.tsx',
      'src/editor-adapters/live/filesystem/__tests__/host.test.tsx',
    ]

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
      expect(source).not.toContain('@wizard-archive/editor/resources/transaction-contract')
      expect(source).not.toContain('@wizard-archive/editor/resources/resource-contract')
      expect(source).not.toContain('RESOURCE_COMMAND_TYPE')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining(['readWizardEditorResourceTransactionReceipt']),
    )
  })

  it('keeps live filesystem tests on adapter resource vocabulary', () => {
    const sourcePaths = [
      'src/editor-adapters/live/filesystem/__tests__/host.test.tsx',
      'src/editor-adapters/live/filesystem/__tests__/read-model.test.tsx',
    ]

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
      expect(source).not.toContain('@wizard-archive/editor/resources/resource-contract')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
  })

  it('keeps live adapter tests on adapter item vocabulary', () => {
    const sourcePaths = [
      'src/editor-adapters/live/__tests__/history-preview-viewer.test.tsx',
      'src/editor-adapters/live/__tests__/use-live-workspace-permissions.test.tsx',
      'src/editor-adapters/live/canvas/__tests__/session-source.test.tsx',
    ]

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
      expect(source).not.toContain('@wizard-archive/editor/resources/history-contract')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
  })

  it('uses canonical UUID identity in route and persisted navigation state', () => {
    const routeIdentityConsumers = [
      'src/editor-adapters/workspace-route-search.ts',
      'src/editor-adapters/live/use-last-workspace-item.ts',
      'src/editor-adapters/live/use-live-workspace-navigation.ts',
    ]

    for (const sourcePath of routeIdentityConsumers) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).toContain('@wizard-archive/editor/resources/domain-id')
      expect(source).not.toContain('ResourceSlug')
      expect(source).not.toContain('parseWizardEditorResourceSlug')
    }
  })

  it('keeps live sort options on the adapter facade', () => {
    const sortOptionConsumers = [
      'src/editor-adapters/live/live-workspace-preferences.ts',
      'src/editor-adapters/live/sidebar/use-live-sidebar-sort-options.ts',
    ]

    for (const sourcePath of sortOptionConsumers) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining([
        'WIZARD_EDITOR_DEFAULT_SORT_OPTIONS',
        'WizardEditorSortDirection',
        'WizardEditorSortOptions',
        'WizardEditorSortOrder',
      ]),
    )
  })

  it('keeps live search item type checks on the adapter facade', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-search.ts'),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
    expect(source).toContain('@wizard-archive/editor/adapter')
    expect(sortedAdapterExports()).toContain('isWizardEditorNoteItem')
  })

  it('keeps live search campaign identity domain-owned', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-search.ts'),
      'utf8',
    )

    expect(source).not.toContain('liveSearchCampaignId')
    expect(source).not.toContain("campaignId: Id<'campaigns'>")
    expect(source).not.toContain('as CampaignId')
    expect(source).toContain('workspaceId: CampaignId')
  })

  it('keeps live sidebar query source ids workspace-shaped', () => {
    for (const sourcePath of [
      'src/editor-adapters/live/use-live-current-item.ts',
      'src/editor-adapters/live/sidebar/use-live-sidebar-items-queries.ts',
      'src/editor-adapters/live/filesystem/sidebar-items-cache.ts',
      'src/editor-adapters/live/sharing/use-live-sidebar-items-share-query.ts',
    ]) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('const { campaignId } = useCampaign()')
      expect(source).toContain('workspaceRecordId')
    }
  })

  it('validates live Yjs source ids at the campaign boundary', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/collaboration/yjs-collaboration.ts'),
      'utf8',
    )

    expect(source).not.toContain('yjsCampaignId')
    expect(source).toContain('yjsWorkspaceRecordId')
    expect(source).toContain('Yjs workspace source id is required')
    expect(source).toContain('assertDomainId(DOMAIN_ID_KIND.campaign, sourceId)')
    expect(source).not.toContain('as CampaignId')
  })

  it('keeps live workspace preferences state workspace-shaped', () => {
    const preferencesSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/live-workspace-preferences.ts'),
      'utf8',
    )
    const sortSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/sidebar/use-live-sidebar-sort-options.ts'),
      'utf8',
    )
    const modeSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-mode.ts'),
      'utf8',
    )

    expect(preferencesSource).not.toContain('liveWorkspacePreferencesQuery(campaignId')
    expect(preferencesSource).toContain('liveWorkspacePreferencesQuery(workspaceRecordId')
    expect(modeSource).not.toContain('const { isDm, campaignId } = useCampaign()')
    expect(modeSource).toContain('workspaceRecordId')
    expect(sortSource).not.toContain('CampaignScopedSortOptions')
    expect(sortSource).not.toContain('activeCampaignId')
    expect(sortSource).not.toContain('clearPendingSortOptionsForCampaign')
    expect(sortSource).toContain('WorkspaceScopedSortOptions')
    expect(sortSource).toContain('activeWorkspaceRecordId')
  })

  it('keeps live recent item storage keys workspace-shaped', () => {
    const recentItemsSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/live-recent-items.ts'),
      'utf8',
    )
    const lastItemSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-last-workspace-item.ts'),
      'utf8',
    )

    expect(recentItemsSource).not.toContain('storageKey(campaignId')
    expect(recentItemsSource).not.toContain('addLiveRecentItem(campaignId')
    expect(recentItemsSource).toContain('workspaceRecordId')
    expect(lastItemSource).not.toContain('last-editor-item-${campaignId}')
    expect(lastItemSource).toContain('workspaceRecordId')
  })

  it('keeps live sharing capability inputs workspace-shaped', () => {
    const capabilitySource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/sharing/share-capability.ts'),
      'utf8',
    )
    const blocksSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/sharing/use-live-blocks-share.ts'),
      'utf8',
    )
    const itemsSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/sharing/use-live-sidebar-items-share.ts'),
      'utf8',
    )

    expect(capabilitySource).not.toContain('campaignId')
    expect(capabilitySource).toContain('workspaceRecordId')
    expect(blocksSource).toContain('campaignId: workspaceRecordId')
    expect(itemsSource).toContain('workspaceRecordId: campaignData?.id')
  })

  it('keeps live sidebar projection item type checks on the adapter facade', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/sidebar/project-live-sidebar-item.ts'),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
    expect(source).toContain('@wizard-archive/editor/adapter')
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining(['isWizardEditorFileItemType', 'isWizardEditorGameMapItemType']),
    )
  })

  it('keeps canvas document session construction off the public package surface', () => {
    const liveCanvasSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/canvas/session-source.ts'),
      'utf8',
    )
    const sessionContractExports = sortedSourceExports(
      'packages/editor/src/canvas/session-contract.ts',
    )

    expect(sortedPublicApiExports()).not.toContain('./canvas/session-contract')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './canvas/session-contract',
    )
    expect(sessionContractExports).not.toContain('CanvasDocumentCollaborationSession')
    expect(liveCanvasSource).not.toContain('@wizard-archive/editor/canvas/session-contract')
    expect(declarationTextForExport('./adapter')).not.toContain('./canvas/session-contract')
  })

  it('keeps embedded canvas update state construction on the adapter facade', () => {
    const liveCanvasSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/canvas/session-source.ts'),
      'utf8',
    )
    const liveCanvasTestSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/canvas/__tests__/session-source.test.tsx'),
      'utf8',
    )

    expect(sortedPublicApiExports()).not.toContain('./canvas/embedded-state')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './canvas/embedded-state',
    )
    expect(liveCanvasSource).not.toContain('@wizard-archive/editor/canvas/embedded-state')
    expect(liveCanvasTestSource).not.toContain('@wizard-archive/editor/canvas/embedded-state')
    expect(liveCanvasSource).toContain('@wizard-archive/editor/adapter')
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining([
        'useWizardEditorEmbeddedCanvasStateFromUpdates',
        'WizardEditorEmbeddedCanvasUpdateSource',
      ]),
    )
    expect(declarationTextForExport('./adapter')).not.toContain('./canvas/embedded-state')
  })

  it('keeps canvas document session hook construction on the adapter facade', () => {
    const adapterConsumers = [
      'src/editor-adapters/live/canvas/session-source.ts',
      'src/editor-adapters/local/in-memory-canvas-session-source.ts',
    ]
    const documentContractConsumers = [
      ...adapterConsumers,
      'src/editor-adapters/local/sample-local-workspace.ts',
    ]

    expect(sortedPublicApiExports()).not.toContain('./canvas/use-document-session')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './canvas/use-document-session',
    )

    for (const sourcePath of documentContractConsumers) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/canvas/document-contract')
    }

    for (const sourcePath of adapterConsumers) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/canvas/use-document-session')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining([
        'WizardEditorCanvasDocumentCollaborationSession',
        'WizardEditorCanvasDocumentSession',
        'createWizardEditorCanvasDocumentDoc',
        'readWizardEditorCanvasDocumentContent',
        'useWizardEditorCanvasDocumentSession',
      ]),
    )
    expect(declarationTextForExport('./adapter')).not.toContain('./canvas/use-document-session')
  })

  it('keeps canvas session port construction on the adapter facade', () => {
    const adapterConsumers = [
      'src/editor-adapters/live/canvas/session-source.ts',
      'src/editor-adapters/live/canvas/__tests__/session-source.test.tsx',
      'src/editor-adapters/local/in-memory-canvas-session-source.ts',
      'src/editor-adapters/local/local-workspace-runtime-adapter.ts',
      'src/editor-adapters/local/__tests__/helpers/session-sources.ts',
    ]

    expect(sortedPublicApiExports()).not.toContain('./canvas/session-source')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './canvas/session-source',
    )

    for (const sourcePath of adapterConsumers) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/canvas/session-source')
      expect(source).not.toContain('@wizard-archive/editor/canvas/item-contract')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining([
        'createWizardEditorCanvasEmbeddedSessionPorts',
        'createWizardEditorCanvasSessionPorts',
        'WizardEditorCanvasEmbeddedSessionPorts',
        'WizardEditorCanvasEmbeddedSessionPortsInput',
        'WizardEditorCanvasSessionPorts',
        'WizardEditorCanvasSessionPortsInput',
      ]),
    )
    expect(sortedAdapterExports()).not.toEqual(
      expect.arrayContaining([
        'createWizardEditorCanvasSidebarEmbedSessionPorts',
        'WizardEditorCanvasSidebarEmbedSessionPorts',
        'WizardEditorCanvasSidebarEmbedSessionPortsInput',
      ]),
    )
    expect(declarationTextForExport('./adapter')).not.toContain('./canvas/session-source')
  })

  it('keeps the root facade intentionally small', () => {
    expect(sortedRootExports()).toEqual([
      'WizardEditor',
      'WizardEditorCanvasViewport',
      'WizardEditorMapTransform',
      'WizardEditorProps',
      'WizardEditorViewStateStores',
      'createBrowserWizardEditorViewStateStores',
    ])
  })

  it('keeps the adapter contract explicit and source-neutral', () => {
    expect(sortedAdapterExports()).toEqual(
      [
        'WizardEditorAdapter',
        'WizardEditorCanvasCollaborationProvider',
        'WizardEditorCanvasDocumentCollaborationSession',
        'WizardEditorCanvasDocumentSession',
        'WizardEditorCanvasEmbeddedSessionPorts',
        'WizardEditorCanvasEmbeddedSessionPortsInput',
        'WizardEditorCanvasSessionPorts',
        'WizardEditorCanvasSessionPortsInput',
        'WizardEditorCatalogDownloadSourceInput',
        'WizardEditorCatalogItemLinkRow',
        'WizardEditorCatalogNavigationInput',
        'WizardEditorCatalogPermissionSourceInput',
        'WizardEditorCatalogResourceSourceInput',
        'WizardEditorCatalogSnapshot',
        'WizardEditorCatalogSnapshotInput',
        'WizardEditorCommandSource',
        'WizardEditorCommandSourceInput',
        'WizardEditorCurrentResourceState',
        'WizardEditorDocumentSource',
        'WizardEditorDocumentFileSourceInput',
        'WizardEditorDocumentSourceInput',
        'WizardEditorDownloadRequest',
        'WizardEditorEmbeddedCanvasState',
        'WizardEditorEmbeddedCanvasUpdate',
        'WizardEditorEmbeddedCanvasUpdateSource',
        'WizardEditorEmbeddedCanvasUpdateState',
        'WizardEditorFileContentSource',
        'WizardEditorFileContentSourceInput',
        'WizardEditorFileSession',
        'WizardEditorFileSessionReplaceInput',
        'WizardEditorFolderItem',
        'WizardEditorFolderItemWithContent',
        'WizardEditorHistoryEntriesInput',
        'WizardEditorHistoryInput',
        'WizardEditorHistoryMemberSummary',
        'WizardEditorHistoryPreviewInput',
        'WizardEditorHistoryRollbackInput',
        'WizardEditorHistoryScope',
        'WizardEditorHistoryScopeInput',
        'WizardEditorHistorySource',
        'WizardEditorHydratedCatalogResourceContentSourceInput',
        'WizardEditorHydratedCatalogSearchSourceInput',
        'WizardEditorIoSource',
        'WizardEditorItem',
        'WizardEditorItemWithContent',
        'WizardEditorMapImageLayer',
        'WizardEditorMapImageReplacementInput',
        'WizardEditorMapImageReplacementStageResult',
        'WizardEditorMapImageSource',
        'WizardEditorMapPinCreationRequest',
        'WizardEditorMapPinCreationsInput',
        'WizardEditorMapSession',
        'WizardEditorNavigation',
        'WizardEditorNavigationResult',
        'WizardEditorNavigationState',
        'WizardEditorNoteCollaborationEngine',
        'WizardEditorNoteCollaborationPlayback',
        'WizardEditorNoteCollaborationSessionMode',
        'WizardEditorNoteCollaborationSessionRequest',
        'WizardEditorNoteEditorSession',
        'WizardEditorNoteHeadingSessionPorts',
        'WizardEditorNotePlaybackSessionPorts',
        'WizardEditorNoteSessionPorts',
        'WizardEditorNoteValueSessionPorts',
        'WizardEditorNoteYjsBeforeDestroyState',
        'WizardEditorNoteYjsPersistenceAdapter',
        'WizardEditorNoteYjsPersistenceSession',
        'WizardEditorPermissionSource',
        'WizardEditorPermissionSourceInput',
        'WizardEditorPdfPreviewGenerationResult',
        'WizardEditorPreviewUpload',
        'WizardEditorPreviewUploadResult',
        'WizardEditorRemoteDownloadResult',
        'WizardEditorRemoteDownloadSource',
        'WizardEditorRemoteDownloadSourceInput',
        'WizardEditorResolvedFile',
        'WizardEditorResolvedMapImage',
        'WizardEditorResourceAvailabilityMetadataSource',
        'WizardEditorResourceAvailabilityMetadataSourceInput',
        'WizardEditorResourceAvailabilityState',
        'WizardEditorResourceAvailabilityStateInput',
        'WizardEditorResourceAvailabilitySubject',
        'WizardEditorResourceCatalog',
        'WizardEditorResourceCatalogCommand',
        'WizardEditorResourceCatalogSourceInput',
        'WizardEditorResourceCommand',
        'WizardEditorResourceCommandCompletionOptions',
        'WizardEditorResourceCommandExecutionOptions',
        'WizardEditorResourceCreateCommand',
        'WizardEditorResourceCreateParentPlan',
        'WizardEditorResourceEvent',
        'WizardEditorResourceOperationItems',
        'WizardEditorResourceRenameCommand',
        'WizardEditorResourceSharingCommand',
        'WizardEditorResourceSource',
        'WizardEditorResourceSlug',
        'WizardEditorRuntimeDocumentSourceInput',
        'WizardEditorRuntimeResourceSourceInput',
        'WizardEditorRuntimeSourcesInput',
        'WizardEditorSearchSource',
        'WizardEditorSharingSourceInput',
        'WizardEditorSortDirection',
        'WizardEditorSortOptions',
        'WizardEditorSortOrder',
        'WizardEditorWorkspaceActor',
        'WizardEditorWorkspaceModeInput',
        'WizardEditorWorkspaceSource',
        'WizardEditorYjsCollaborationSessionInput',
        'WIZARD_EDITOR_DEFAULT_SORT_OPTIONS',
        'WIZARD_EDITOR_RESOURCE_COMMAND_TYPE',
        'WIZARD_EDITOR_RESOURCE_EVENT_TYPE',
        'completeWizardEditorResourceCommand',
        'completeWizardEditorMapPinOperation',
        'createWizardEditorCanvasDocumentDoc',
        'createWizardEditorCatalogItemLink',
        'createWizardEditorCatalogIoSource',
        'createWizardEditorCatalogItemSearchResult',
        'createWizardEditorCatalogNavigation',
        'createWizardEditorCatalogResourceContentSource',
        'createWizardEditorCanvasEmbeddedSessionPorts',
        'createWizardEditorCanvasSessionPorts',
        'createWizardEditorCommandSource',
        'createWizardEditorDocumentSource',
        'createWizardEditorFileContentSource',
        'createWizardEditorHistorySource',
        'createWizardEditorImportedTextNotePayload',
        'createWizardEditorNoteYDocFromContent',
        'createWizardEditorPermissionSource',
        'createWizardEditorPlainTextNoteContent',
        'createWizardEditorRemoteDownloadSource',
        'createWizardEditorResourceAvailabilityMetadataSource',
        'createWizardEditorResourceCatalogSource',
        'createWizardEditorRuntime',
        'createWizardEditorRuntimeSources',
        'createWizardEditorSharingSource',
        'createWizardEditorCatalogSearchSource',
        'createWizardEditorCatalogSnapshot',
        'createWizardEditorCatalogResourceSource',
        'createWizardEditorUnsupportedHistorySource',
        'filterWizardEditorItemsForActor',
        'flushWizardEditorYjsProviderPendingUpdates',
        'getWizardEditorNavigationCurrentResourceId',
        'hasWizardEditorGameMapPin',
        'isPersistedWizardEditorItem',
        'isPersistedWizardEditorItemId',
        'isWizardEditorFileItem',
        'isWizardEditorFileItemType',
        'isWizardEditorGameMapItem',
        'isWizardEditorGameMapItemType',
        'isWizardEditorItemWithContent',
        'isWizardEditorNoteItem',
        'isWizardEditorResourceCatalogCommand',
        'isWizardEditorResourceSharingCommand',
        'isWizardEditorYjsProviderApplyingRemoteUpdate',
        'parseWizardEditorResourceSlug',
        'planWizardEditorMapPinCreations',
        'readWizardEditorCanvasDocumentContent',
        'readWizardEditorGameMapPinnedItemIds',
        'readWizardEditorNoteYDocMarkdown',
        'readWizardEditorResourceTransactionReceipt',
        'replaceWizardEditorMapImage',
        'resolveWizardEditorMapImage',
        'runWizardEditorPdfPreviewGeneration',
        'resolveWizardEditorHistoryScope',
        'resolveWizardEditorResourceAvailabilityState',
        'resolveWizardEditorWorkspaceModeForItem',
        'resolveWizardEditorNavigationState',
        'updateWizardEditorYjsProviderUser',
        'useWizardEditorCanvasDocumentSession',
        'useWizardEditorEmbeddedCanvasStateFromUpdates',
        'useWizardEditorHydratedCatalogResourceContentSource',
        'useWizardEditorHydratedCatalogSearchSource',
        'useWizardEditorNoteYjsPersistenceLifecycle',
        'useWizardEditorResourceCommandRuntime',
        'useWizardEditorYjsCollaborationSession',
      ].sort(),
    )
  })

  it('keeps resource content on the authoritative runtime filesystem', () => {
    const sourcePath = 'packages/editor/src/filesystem/filesystem.ts'
    const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

    expect(interfaceMemberNames(sourcePath, source, 'WorkspaceFileSystem')).toContain(
      'resourceContent',
    )
    expect(interfaceMemberNames(sourcePath, source, 'WorkspaceFileSystem')).not.toContain(
      'resourcePreview',
    )
  })

  it('keeps resource content resolution on the resourceContent source only', () => {
    const sourcePaths = [
      'packages/editor/src/adapter.ts',
      'packages/editor/src/index.ts',
      'packages/editor/src/filesystem/filesystem.ts',
      'packages/editor/src/test/workspace-runtime-factory.ts',
      'packages/editor/src/workspace/right-sidebar/source.ts',
      'packages/editor/src/workspace/right-sidebar/runtime-source.ts',
      'packages/editor/src/workspace/right-sidebar/panels.tsx',
      'packages/editor/src/workspace/right-sidebar/components/link-list.tsx',
      'src/editor-adapters/local/__tests__/helpers/local-runtime.ts',
      'src/editor-adapters/local/__tests__/local-workspace-runtime-adapter.test.ts',
    ]

    expect(
      existsSync(path.join(process.cwd(), 'packages/editor/src/filesystem/resource-preview.ts')),
    ).toBe(false)

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('/resource-preview')
      expect(source).not.toContain("resource-preview'")
      expect(source).not.toContain('FileSystemResourcePreview')
      expect(source).not.toContain('ItemContentState')
      expect(source).not.toContain('createFileSystemResourcePreviewFromResourceContent')
      expect(source).not.toContain('createItemContentState')
      expect(source).not.toContain('ensureItemPreviewState')
      expect(source).not.toContain('getItemContentState')
    }
  })

  it('makes the root editor consume the authoritative runtime without translation', () => {
    const source = readFileSync(path.join(process.cwd(), 'packages/editor/src/index.ts'), 'utf8')
    const declaration = declarationTextForExport('.')

    expect(source).toContain("from './workspace/runtime'")
    expect(source).toContain('runtime: WorkspaceRuntime')
    expect(source).toContain('createElement(WorkspaceRuntimeHost, props)')
    expect(source).not.toContain('toWorkspaceRuntime')
    expect(declaration).toMatch(/\bWorkspaceRuntime\b/)
    expect(declaration).not.toMatch(/\bSidebarItemId\b/)
    expect(declaration).toContain('runtime: WorkspaceRuntime')
  })

  it('keeps the adapter as construction input instead of a second runtime model', () => {
    const source = readFileSync(path.join(process.cwd(), 'packages/editor/src/adapter.ts'), 'utf8')
    const declaration = declarationTextForExport('./adapter')

    expect(source).not.toContain('ReturnType<typeof')
    expect(source).not.toContain('Parameters<typeof')
    expect(
      interfaceMemberNames('packages/editor/src/adapter.ts', source, 'WizardEditorRuntime'),
    ).toEqual([])
    expect(
      interfaceMemberNames(
        'packages/editor/src/adapter.ts',
        source,
        'WizardEditorRuntimeResources',
      ),
    ).toEqual([])
    expect(
      interfaceMemberNames('packages/editor/src/adapter.ts', source, 'WizardEditorRuntimeCommands'),
    ).toEqual([])
    expect(source).toContain(
      'createWizardEditorRuntime(adapter: WizardEditorAdapter): WorkspaceRuntime',
    )
    expect(source).toContain('return workspaceRuntime')
    expect(declaration).not.toContain('operation-construction')
    expect(declaration).not.toContain('WorkspaceFileSystemOperationDriver')
    expect(declaration).not.toContain('WorkspaceFileSystemClipboardDriver')
    expect(declaration).not.toContain('WorkspaceFileSystemTrashDriver')
    expect(declaration).not.toContain('WorkspaceFileSystemDropDriver')
    expect(declaration).not.toContain('FileSystemOperationDriver')
    expect(declaration).not.toContain('FileSystemClipboardDriver')
    expect(declaration).not.toContain('FileSystemTrashDriver')
    expect(declaration).not.toContain('FileSystemDropDriver')
    expect(declaration).not.toContain('FileSystemHistoryOperationDriver')
    expect(declaration).not.toContain('FileSystemResourceCommandDriver')
    expect(declaration).not.toContain('FileSystemOperationRuntime')
    expect(declaration).not.toContain('FileSystemCommandCapabilities')
    expect(declaration).not.toContain('FileSystemIoCapabilities')
    expect(declaration).not.toMatch(/\bSidebarItemId\b/)
    expect(declaration).not.toContain('ReturnType<')
    expect(declaration).not.toContain('Parameters<')
  })

  it('keeps one root runtime model', () => {
    const sourcePath = path.join(process.cwd(), 'packages/editor/src/workspace/runtime.ts')
    const source = readFileSync(sourcePath, 'utf8')

    expect(interfaceMemberNames(sourcePath, source, 'WorkspaceRuntime')).toEqual(
      ['filesystem', 'navigation', 'sessions', 'workspace'].sort(compareText),
    )
    const adapterSourcePath = 'packages/editor/src/adapter.ts'
    const adapterSource = readFileSync(path.join(process.cwd(), adapterSourcePath), 'utf8')
    expect(interfaceMemberNames(adapterSourcePath, adapterSource, 'WizardEditorRuntime')).toEqual(
      [],
    )
  })

  it('keeps access policy behind the adapter facade', () => {
    expect(sortedPublicApiExports()).not.toContain('./resources/access')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain('./resources/access')

    const adapterSources = ['src/editor-adapters/live', 'src/editor-adapters/local'].flatMap(
      (sourceRoot) =>
        readdirSync(path.join(process.cwd(), sourceRoot), { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => path.join(entry.parentPath, entry.name)),
    )

    for (const sourcePath of adapterSources) {
      const source = readFileSync(sourcePath, 'utf8')
      expect(source).not.toContain('@wizard-archive/editor/resources/access')
    }
  })

  it('keeps adapter resource inputs free of cross-domain runtime sources', () => {
    const sourcePath = path.join(process.cwd(), 'packages/editor/src/adapter.ts')
    const source = readFileSync(sourcePath, 'utf8')

    expect(interfaceMemberNames(sourcePath, source, 'WizardEditorAdapter')).toEqual(
      [
        'commands',
        'documents',
        'history',
        'io',
        'navigation',
        'resources',
        'search',
        'sharing',
        'workspace',
      ].sort(compareText),
    )
    expect(
      interfaceMemberNames(sourcePath, source, 'WizardEditorRuntimeResourceSourceInput'),
    ).toEqual(
      [
        'catalog',
        'current',
        'load',
        'operationItems',
        'paths',
        'permissions',
        'resourceContent',
      ].sort(compareText),
    )
    expect(
      interfaceMemberNames(sourcePath, source, 'WizardEditorCatalogResourceSourceInput'),
    ).toEqual(['permissions', 'snapshot'].sort(compareText))
  })

  it('keeps runtime construction on one adapter source path', () => {
    const sourcePath = 'packages/editor/src/adapter.ts'
    const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')
    const exports = sortedSourceExports(sourcePath)

    expect(source).not.toMatch(/\bkind:\s*['"]runtime['"]/)
    expect(source).not.toMatch(/\bkind:\s*['"]staticCatalog['"]/)
    expect(source).not.toMatch(/\bWizardEditorLiveSourcesInput\b/)
    expect(source).not.toMatch(/\bWizardEditorStandaloneRuntimeInput\b/)
    expect(source).not.toMatch(/\bWizardEditorStandaloneSourcesInput\b/)
    expect(source).not.toMatch(/\bcreateWizardEditorLiveSources\b/)
    expect(source).not.toMatch(/\bcreateWizardEditorStandalone(Runtime|Sources)\b/)
    expect(exports).toContain('createWizardEditorRuntimeSources')
    expect(exports).not.toContain('createWizardEditorLiveSources')
    expect(exports).not.toContain('createWizardEditorStandaloneRuntime')
    expect(exports).not.toContain('createWizardEditorStandaloneSources')
  })

  it('keeps note session port construction on the adapter facade', () => {
    const adapterConsumers = [
      'src/editor-adapters/live/notes/session-source.ts',
      'src/editor-adapters/live/notes/__tests__/session-source.test.tsx',
      'src/editor-adapters/local/in-memory-note-session-source.ts',
      'src/editor-adapters/local/local-workspace-runtime-adapter.ts',
      'src/editor-adapters/local/__tests__/helpers/session-sources.ts',
      'src/editor-adapters/local/__tests__/in-memory-note-session-source.test.tsx',
      'src/editor-adapters/local/__tests__/local-workspace-runtime-adapter.test.ts',
    ]

    expect(sortedPublicApiExports()).not.toContain('./notes/session-source')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './notes/session-source',
    )

    for (const sourcePath of adapterConsumers) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/notes/session-source')
      if (sourcePath.includes('note-session-source')) {
        expect(source).not.toContain('@wizard-archive/editor/notes/item-contract')
        expect(source).not.toContain('@wizard-archive/editor/notes/imported-text')
      }
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
    expect(sortedAdapterExports()).toEqual(expect.arrayContaining(['WizardEditorNoteSessionPorts']))
    expect(declarationTextForExport('./adapter')).not.toContain('./notes/session-source')
  })

  it('keeps note editor session state on the adapter facade without construction bags', () => {
    const adapterConsumers = [
      'src/editor-adapters/live/notes/session-source.ts',
      'src/editor-adapters/local/in-memory-note-session-source.ts',
      'src/editor-adapters/local/__tests__/helpers/session-sources.ts',
      'src/editor-adapters/local/__tests__/local-workspace-runtime.test.ts',
    ]

    expect(sortedPublicApiExports()).not.toContain('./notes/session-contract')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './notes/session-contract',
    )

    for (const sourcePath of adapterConsumers) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/notes/session-contract')
      expect(source).not.toContain('createWizardEditorNoteEditorSession')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining([
        'WizardEditorNoteCollaborationSessionMode',
        'WizardEditorNoteCollaborationSessionRequest',
        'WizardEditorNoteEditorSession',
      ]),
    )
    expect(sortedAdapterExports()).not.toContain('WizardEditorNoteEditorSessionInput')
    expect(sortedAdapterExports()).not.toContain('createWizardEditorNoteEditorSession')
    expect(declarationTextForExport('./adapter')).not.toContain('./notes/session-contract')
  })

  it('keeps note collaboration playback construction on the adapter facade', () => {
    const adapterConsumers = [
      'src/editor-adapters/local/in-memory-note-session-source.ts',
      'src/editor-adapters/local/local-workspace-runtime-host.tsx',
      'src/editor-adapters/local/public-demo-workspace-presets.ts',
      'src/editor-adapters/local/use-local-workspace-runtime.ts',
    ]

    expect(sortedPublicApiExports()).not.toContain('./notes/playback-contract')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './notes/playback-contract',
    )

    for (const sourcePath of adapterConsumers) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/notes/document-contract')
      expect(source).not.toContain('@wizard-archive/editor/notes/playback-contract')
      expect(source).not.toContain('CampaignId')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining(['WizardEditorNoteCollaborationPlayback']),
    )
    expect(declarationTextForExport('./adapter')).not.toContain('./notes/playback-contract')
  })

  it('keeps note session ports split into feature-owned ports', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/notes/workspace-session-source.ts'),
      'utf8',
    )
    const valueRuntimeModelSource = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/notes/value-runtime-model.ts'),
      'utf8',
    )
    const sessionContractExports = sortedSourceExports(
      'packages/editor/src/notes/session-contract.ts',
    )
    const noteSessionInterface = source.match(
      /export interface NoteSessionPorts \{[\s\S]*?\n\}/,
    )?.[0]

    expect(source).not.toContain('NoteSessionPorts extends NoteSessionSource')
    expect(source).toContain('export interface NoteSessionPorts')
    expect(noteSessionInterface).toContain('document: NoteDocumentSessionSource')
    expect(noteSessionInterface).not.toContain('values: NoteValueRuntimeStateSource')
    expect(noteSessionInterface).not.toContain('import: NoteImportSource')
    expect(noteSessionInterface).not.toContain('headings: NoteHeadingSource')
    expect(noteSessionInterface).not.toContain('playback: NotePlaybackSource')
    expect(source).not.toContain('export interface NoteContentSessionPorts')
    expect(source).toContain('export interface NoteHeadingSessionPorts')
    expect(source).toContain('export interface NotePlaybackSessionPorts')
    expect(source).toContain('export interface NoteValueSessionPorts')
    expect(source).toContain('headings: NoteHeadingSource')
    expect(source).toContain('playback: NotePlaybackSource')
    expect(source).toContain('values: NoteValueRuntimeStateSource')
    expect(source).not.toContain('export type NoteValueStatesForNotesStatus')
    expect(source).not.toContain('export interface NoteValueRuntimeStateSource')
    expect(source).not.toContain('NoteValueStatesForNotesStatus')
    expect(valueRuntimeModelSource).toContain('export type NoteValueStatesForNotesStatus')
    expect(valueRuntimeModelSource).toContain('export interface NoteValueRuntimeStateSource')
    expect(sessionContractExports).not.toContain('NoteSessionSource')
    expect(sessionContractExports).not.toContain('NoteCollaborationSessionRequest')
  })

  it('keeps note import initialization on command-owned content initializers', () => {
    const source = readFileSync(path.join(process.cwd(), 'packages/editor/src/adapter.ts'), 'utf8')

    expect(source).not.toContain('documents.note.import')
    expect(source).toContain('contentInitializers: ResourceImportContentInitializers')
  })

  it('keeps adapter free of canvas-owned sidebar embed port contracts', () => {
    const source = readFileSync(path.join(process.cwd(), 'packages/editor/src/adapter.ts'), 'utf8')

    expect(source).not.toContain('WizardEditorCanvasSidebarItemEmbed')
    expect(source).not.toContain('WizardEditorCanvasSidebarEmbedSource')
    expect(source).not.toContain('WizardEditorCanvasSidebarEmbedCapability')
    expect(source).not.toContain('WizardEditorCanvasSidebarEmbedSessionPorts')
    expect(source).not.toContain('createWizardEditorCanvasSidebarEmbedSessionPorts')
  })

  it('keeps adapter availability participant-shaped with canonical member identity', () => {
    const source = readFileSync(path.join(process.cwd(), 'packages/editor/src/adapter.ts'), 'utf8')
    const participantAdapterSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/sharing/share-participants.ts'),
      'utf8',
    )
    const implementationDeclaration = declarationImplementationTextForExport('./adapter')

    for (const text of [source, implementationDeclaration]) {
      expect(text).not.toContain('directMessage: WizardEditorResourceAvailabilityMetadataLookup')
      expect(text).not.toContain('player: WizardEditorResourceAvailabilityMetadataLookup')
      expect(text).not.toContain('viewAsPlayerId: CampaignMemberId')
    }
    expect(source).toContain('owner: WizardEditorResourceAvailabilityMetadataLookup')
    expect(source).toContain('participant: WizardEditorResourceAvailabilityMetadataLookup')
    expect(source).toContain('participantId: CampaignMemberId')
    expect(source).toContain('viewAsParticipantId: CampaignMemberId | undefined')
    expect(participantAdapterSource).toContain('@wizard-archive/editor/sharing')
    expect(participantAdapterSource).not.toContain('@wizard-archive/editor/adapter')
  })

  it('keeps adapter canvas document sessions scoped to canvas resources', () => {
    const source = readFileSync(path.join(process.cwd(), 'packages/editor/src/adapter.ts'), 'utf8')

    expect(source).not.toContain('CampaignId as InternalWorkspaceId')
    expect(source).not.toContain('InternalWorkspaceId')
    expect(source).not.toContain('campaignId: InternalWorkspaceId')
    expect(
      interfaceMemberNames(
        'packages/editor/src/adapter.ts',
        source,
        'WizardEditorCanvasSessionPorts',
      ),
    ).toEqual(['document'])
  })

  it('keeps the canvas document session hook workspace-shaped internally', () => {
    const sessionContract = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/canvas/session-contract.ts'),
      'utf8',
    )
    const hookSource = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/canvas/use-document-session.ts'),
      'utf8',
    )

    for (const source of [sessionContract, hookSource]) {
      expect(source).not.toContain('campaignId:')
      expect(source).not.toContain('CampaignId')
      expect(source).toContain('workspaceId')
    }
    expect(hookSource).not.toContain("workspaceId: CanvasItemWithContent['campaignId']")
    expect(hookSource).not.toContain('workspaceId: canvas.campaignId')
    expect(hookSource).toContain('workspaceId: string')
    expect(hookSource).not.toContain("from '../../../../shared/common/ids'")
  })

  it('keeps drag drop planning context workspace-shaped', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/drag-drop/planning-context.ts'),
      'utf8',
    )

    expect(source).not.toContain('CampaignId')
    expect(source).not.toContain('campaignId:')
    expect(source).not.toContain('campaignName')
    expect(source).toContain('workspaceId: string | null')
    expect(source).toContain('workspaceName: string | null')
    expect(source).toContain("Pick<DropPlanningContext, 'workspaceId'>")
  })

  it('keeps note link drop validation workspace-shaped', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/notes/links/drop-validation.ts'),
      'utf8',
    )

    expect(source).not.toContain('TCampaignId')
    expect(source).not.toContain('campaignId,')
    expect(source).not.toContain('campaignId:')
    expect(source).not.toContain('campaignId: TCampaignId')
    expect(source).toContain('TWorkspaceId extends string')
    expect(source).toContain('workspaceId: TWorkspaceId | null')
  })

  it('keeps drag-drop rejection vocabulary workspace-shaped', () => {
    for (const relativePath of [
      'packages/editor/src/drag-drop/rejections.ts',
      'packages/editor/src/notes/links/drop-validation.ts',
      'packages/editor/src/workspace/items/create-parent-target.ts',
    ]) {
      const source = readFileSync(path.join(process.cwd(), relativePath), 'utf8')

      expect(source).not.toContain('wrong_campaign')
      expect(source).not.toContain('another campaign')
      expect(source).not.toContain('campaign root')
    }
  })

  it('keeps drag-drop command internals out of the public editor API', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(process.cwd(), 'packages/editor/package.json'), 'utf8'),
    ) as { exports: Record<string, unknown> }
    const indexSource = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/index.ts'),
      'utf8',
    )
    const adapterSource = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/adapter.ts'),
      'utf8',
    )

    expect(Object.keys(packageJson.exports).some((subpath) => subpath.includes('drag-drop'))).toBe(
      false,
    )
    for (const source of [indexSource, adapterSource]) {
      expect(source).not.toContain('DropPayload')
      expect(source).not.toContain('PlannedDropCommand')
      expect(source).not.toContain('ExternalFileDropTargetCapability')
      expect(source).not.toContain("from './drag-drop/")
    }
  })

  it('keeps editor user-facing copy workspace-shaped', () => {
    for (const relativePath of [
      'packages/editor/src/files/forms/dialog.tsx',
      'packages/editor/src/files/viewer/viewer.tsx',
      'packages/editor/src/sharing/block/permission-menu.tsx',
      'packages/editor/src/sharing/sidebar-items/permission-menu.tsx',
      'packages/editor/src/workspace/topbar/view-as-button.tsx',
    ]) {
      const source = readFileSync(path.join(process.cwd(), relativePath), 'utf8')

      expect(source).not.toContain('your campaign')
      expect(source).not.toContain('the campaign')
      expect(source).not.toContain('this campaign')
    }
  })

  it('keeps sidebar selection command names workspace-shaped', () => {
    for (const relativePath of [
      'packages/editor/src/workspace/sidebar/ui-store.ts',
      'packages/editor/src/workspace/sidebar/workspace-state.ts',
    ]) {
      const source = readFileSync(path.join(process.cwd(), relativePath), 'utf8')

      expect(source).not.toContain('clearSelectionForCampaignChange')
      expect(source).toContain('clearSelectionForWorkspaceChange')
    }
  })

  it('keeps canvas document and embedded canvas sessions split without sidebar embed sessions', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/canvas/workspace-session-source.ts'),
      'utf8',
    )

    expect(source).not.toContain('CanvasSessionPorts extends CanvasSessionSource')
    expect(source).toContain('export interface CanvasSessionPorts')
    const canvasSessionInterface = source.match(
      /export interface CanvasSessionPorts \{[\s\S]*?\n\}/,
    )?.[0]
    expect(canvasSessionInterface).toContain('document: CanvasSessionSource')
    expect(canvasSessionInterface).not.toContain('embedResolution: CanvasEmbedResolutionSource')
    expect(canvasSessionInterface).not.toContain('previewUpload: PreviewUploadCapability')
    expect(source).not.toContain('export interface CanvasEmbedSessionPorts')
    expect(source).toContain('export interface CanvasEmbeddedSessionPorts')
    expect(source).toContain('embeddedCanvas: CanvasEmbeddedCanvasSource')
    expect(source).not.toContain('export interface CanvasSidebarEmbedSessionPorts')
    expect(source).not.toContain('sidebarItemEmbeds: CanvasSidebarItemEmbedSource')
    expect(source).not.toContain('previewUpload: PreviewUploadCapability')
  })

  it('keeps operation-set construction inside the editor package runtime boundary', () => {
    const adapterSources = [
      'src/editor-adapters/live/use-live-workspace-runtime.ts',
      'src/editor-adapters/local/local-workspace-runtime-adapter.ts',
    ]

    for (const sourcePath of adapterSources) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('createWorkspaceFileSystemOperations')
      expect(source).not.toMatch(
        /from ['"]@wizard-archive\/editor\/resources\/operation-adapter['"]/,
      )
    }
  })

  it('keeps actor permission construction inside the editor package runtime boundary', () => {
    const adapterSources = [
      'src/editor-adapters/live/use-live-workspace-runtime.ts',
      'src/editor-adapters/local/local-workspace-runtime-adapter.ts',
    ]

    for (const sourcePath of adapterSources) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('createActorFileSystemPermissions')
    }
  })

  it('keeps permission source assembly inside the editor package runtime boundary', () => {
    const adapterSources = [
      'src/editor-adapters/live/use-live-workspace-runtime.ts',
      'src/editor-adapters/local/local-workspace-runtime-adapter.ts',
    ]

    for (const sourcePath of adapterSources) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('createLiveRuntimePermissionSource')
      expect(source).not.toMatch(/\bcanEmptyTrash\s*:/)
      expect(source).not.toMatch(/\bcanManageFolders\s*:/)
      if (sourcePath.includes('/local/')) {
        expect(source).not.toContain('createWizardEditorPermissionSource')
        expect(source).toContain('createWizardEditorRuntimeSources')
      } else {
        expect(source).toContain('createWizardEditorPermissionSource')
      }
    }
  })

  it('keeps command capability construction inside the editor package runtime boundary', () => {
    const adapterSources = [
      'src/editor-adapters/live/use-live-workspace-runtime.ts',
      'src/editor-adapters/local/local-workspace-runtime-adapter.ts',
    ]

    for (const sourcePath of adapterSources) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('capabilities:')
      expect(source).not.toMatch(/\bcreateItems\s*:/)
      expect(source).toMatch(/createWizardEditor(CommandSource|RuntimeSources)/)
    }
  })

  it('keeps local catalog navigation assembly inside the editor package runtime boundary', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-workspace-runtime-adapter.ts'),
      'utf8',
    )

    expect(source).not.toContain('openDefaultItem')
    expect(source).not.toContain('openCreateDashboard')
    expect(source).not.toContain('openTrash')
    expect(source).not.toMatch(/\bopenItem\s*:/)
    expect(source).toContain('createWizardEditorCatalogNavigation')
  })

  it('keeps local file content source assembly inside the editor package runtime boundary', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-workspace-runtime-adapter.ts'),
      'utf8',
    )

    expect(source).not.toContain('createLocalFileSessionSource')
    expect(source).not.toContain('createLocalImportedFileInitializer')
    expect(source).not.toContain('completedResourceOperation')
    expect(source).not.toMatch(/\bkind:\s*['"]fileImported['"]/)
    expect(source).not.toMatch(/\bkind:\s*['"]fileReplaced['"]/)
    expect(source).not.toMatch(/\bresolveFileDownloadUrl:\s*\(file\)/)
    expect(source).not.toContain('createWizardEditorFileContentSource')
    expect(source).toContain('createWizardEditorRuntimeSources')
  })

  it('keeps live file content source assembly inside the editor package runtime boundary', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/files/session-source.ts'),
      'utf8',
    )

    expect(source).not.toContain('completedResourceOperation')
    expect(source).not.toMatch(/\bkind:\s*['"]fileImported['"]/)
    expect(source).not.toMatch(/\bkind:\s*['"]fileReplaced['"]/)
    expect(source).not.toMatch(/\breplaceFile\s*:/)
    expect(source).toContain('createWizardEditorFileContentSource')
  })

  it('keeps live remote download source assembly inside the editor package runtime boundary', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/filesystem/download.ts'),
      'utf8',
    )

    expect(source).not.toMatch(/\bkind:\s*['"]remoteItems['"]/)
    expect(source).not.toMatch(/\bstatus:\s*['"]unsupported['"]/)
    expect(source).toContain('createWizardEditorRemoteDownloadSource')
  })

  it('keeps static resource source assembly inside the editor package runtime boundary', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-workspace-runtime-adapter.ts'),
      'utf8',
    )

    expect(source).not.toContain("kind: 'staticCatalog'")
    expect(source).not.toMatch(/\boperationItems\s*:/)
    expect(source).toContain('createWizardEditorRuntimeSources')
  })

  it('keeps live runtime resource source assembly inside the editor package runtime boundary', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-runtime.ts'),
      'utf8',
    )

    expect(source).not.toContain("kind: 'runtime'")
    expect(source).toContain('createWizardEditorRuntimeSources')
  })

  it('keeps document source assembly inside the editor package runtime boundary', () => {
    const adapterSources = [
      'src/editor-adapters/live/use-live-workspace-runtime.ts',
      'src/editor-adapters/local/local-workspace-runtime-adapter.ts',
    ]

    for (const sourcePath of adapterSources) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      if (source.includes('createWizardEditorRuntimeSources')) {
        expect(source).not.toContain('createWizardEditorDocumentSource')
      } else {
        expect(source).not.toMatch(/\bdocuments:\s*\{/)
      }
      expect(source).toMatch(/createWizardEditor(DocumentSource|RuntimeSources)/)
    }
  })

  it('keeps runtime sharing source assembly inside the editor package runtime boundary', () => {
    const adapterSources = [
      'src/editor-adapters/live/use-live-workspace-runtime.ts',
      'src/editor-adapters/local/local-workspace-runtime-adapter.ts',
    ]

    for (const sourcePath of adapterSources) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('WorkspaceFileSystemSharing')
      expect(source).not.toMatch(/\bblocks:\s*\{\s*status:\s*['"]unsupported['"]/)
      expect(source).not.toMatch(/\bitems:\s*\{\s*status:\s*['"]unsupported['"]/)
      expect(source).not.toContain('createLocalFileSystemSharing')
      if (sourcePath.includes('/local/')) {
        expect(source).not.toContain('createWizardEditorSharingSource')
        expect(source).toContain('createWizardEditorRuntimeSources')
      } else {
        expect(source).toContain('createWizardEditorSharingSource')
      }
    }
  })

  it('keeps hydrated search service construction inside the editor package runtime boundary', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-search.ts'),
      'utf8',
    )

    expect(source).not.toContain('createCatalogFileSystemSearch')
    expect(source).not.toContain('createItemContentState')
  })

  it('keeps catalog model helpers on the stable adapter facade', () => {
    const exports = sortedPublicApiExports()
    const adapterConsumers = [
      'src/editor-adapters/live/use-live-workspace-search.ts',
      'src/editor-adapters/local/local-game-map-session-source.ts',
      'src/editor-adapters/local/local-filesystem-operations.ts',
      'src/editor-adapters/local/local-filesystem-command-receipts.ts',
      'src/editor-adapters/local/in-memory-canvas-session-source.ts',
    ]

    expect(exports).not.toContain('./resources/catalog')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './resources/catalog',
    )

    for (const sourcePath of adapterConsumers) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/resources/catalog')
    }
  })

  it('keeps local filesystem command receipts on adapter item vocabulary', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/local/local-filesystem-command-receipts.ts'),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/resources/items-persistence-contract')
  })

  it('keeps PDF preview generation on the adapter facade', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/previews/use-pdf-preview-upload.ts'),
      'utf8',
    )

    expect(sortedPublicApiExports()).not.toContain('./files/pdf-preview-generation')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './files/pdf-preview-generation',
    )
    expect(source).not.toContain('@wizard-archive/editor/files/pdf-preview-generation')
    expect(source).toContain('@wizard-archive/editor/adapter')
  })

  it('keeps map image replacement on the adapter facade', () => {
    const adapterConsumers = [
      'src/editor-adapters/live/game-maps/session-source.ts',
      'src/editor-adapters/local/local-game-map-session-source.ts',
      'src/editor-adapters/local/local-workspace-runtime-adapter.ts',
    ]

    expect(sortedPublicApiExports()).not.toContain('./game-maps/map-image-replacement')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './game-maps/map-image-replacement',
    )

    for (const sourcePath of adapterConsumers) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/game-maps/map-image-replacement')
      expect(source).not.toContain('@wizard-archive/editor/game-maps/image-resolution')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
    expect(sortedAdapterExports()).toEqual(expect.arrayContaining(['resolveWizardEditorMapImage']))
  })

  it('keeps sharing public symbols limited to adapter facts and state factories', () => {
    expect(sortedSharingExports()).toEqual([
      'BlockShareProjectionData',
      'BlockShareTargetBlock',
      'BlockShareTargetNote',
      'BlocksShareOperations',
      'BlocksShareProjection',
      'BlocksShareSource',
      'BlocksShareState',
      'EDITOR_PERMISSION_LEVEL',
      'EditorPermissionLevel',
      'EditorShareParticipant',
      'ResourceShareOperations',
      'ResourceShareProjection',
      'ResourceShareProjectionData',
      'ResourceShareSource',
      'ResourceShareState',
      'ShareActionResult',
      'UnsupportedSharingSource',
      'ViewAsParticipantCapability',
      'WizardEditorSharingSource',
      'createBlocksShareRuntimeState',
      'createResourceShareRuntimeState',
    ])
  })

  it('keeps sharing state factories on the stable sharing adapter leaf', () => {
    const exports = sortedPublicApiExports()

    expect(exports).not.toContain('./sharing/block/state')
    expect(exports).not.toContain('./sharing/sidebar-items/state')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toEqual(
      expect.arrayContaining(['./sharing/block/state', './sharing/sidebar-items/state']),
    )

    const adapterSources = [
      'src/editor-adapters/live/sharing/use-live-blocks-share.ts',
      'src/editor-adapters/live/sharing/use-live-sidebar-items-share.ts',
    ]

    for (const sourcePath of adapterSources) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/sharing/block/state')
      expect(source).not.toContain('@wizard-archive/editor/sharing/sidebar-items/state')
    }
  })

  it('keeps live sharing tests on stable sharing contracts', () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        'src/editor-adapters/live/sharing/__tests__/use-live-blocks-share.test.tsx',
      ),
      'utf8',
    )

    expect(source).not.toContain('@wizard-archive/editor/notes/item-contract')
    expect(source).toContain('@wizard-archive/editor/sharing')
  })

  it('keeps live sharing command results off raw transaction imports', () => {
    const adapterSources = [
      'src/editor-adapters/live/sharing/use-live-blocks-share.ts',
      'src/editor-adapters/live/sharing/use-share-mutation-runner.ts',
    ]

    for (const sourcePath of adapterSources) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/resources/transaction-contract')
    }
  })

  it('keeps local filesystem command results on adapter transaction vocabulary', () => {
    const adapterSources = [
      'src/editor-adapters/local/local-filesystem-operations.ts',
      'src/editor-adapters/local/local-filesystem-command-receipts.ts',
    ]

    for (const sourcePath of adapterSources) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('@wizard-archive/editor/resources/transaction-contract')
      expect(source).toContain('@wizard-archive/editor/adapter')
    }
  })

  it('keeps note block identities in Wizard-owned public vocabulary', () => {
    for (const subpath of ['./notes/document-contract', './notes/values-contract', './sharing']) {
      expect(declarationTextForExport(subpath)).not.toMatch(/\bblockNoteId(s)?\b/)
    }
  })

  it('keeps sharing contracts provider-neutral while using canonical member identity', () => {
    for (const subpath of ['./adapter', './sharing']) {
      const contract = readFileSync(path.join(process.cwd(), sourcePathForExport(subpath)), 'utf8')

      expect(contract).toContain('CampaignMemberId')
      expect(contract).not.toContain('Id<"campaignMembers">')
      expect(contract).not.toContain('convex/_generated/dataModel')
    }
  })

  it('keeps public resource ownership domain-owned and provider-neutral', () => {
    for (const subpath of ['./resources/patch-contract', './game-maps/document-contract']) {
      const declaration = declarationTextForExport(subpath)
      const source = readFileSync(path.join(process.cwd(), sourcePathForExport(subpath)), 'utf8')

      expect(source).not.toContain('convex/_generated')
      expect(source).not.toMatch(/\bId<['"]/)
      expect(declaration).not.toMatch(/\bId<['"]/)
    }
    expect(
      readFileSync(
        path.join(process.cwd(), sourcePathForExport('./resources/patch-contract')),
        'utf8',
      ),
    ).toContain('CampaignId')
  })

  it('keeps resource operation capability exports in resource terminology', () => {
    expect(sortedResourceOperationCapabilityExports()).toEqual([
      'OperationActorSnapshot',
      'OperationResourceItem',
      'ResourceOperationCapability',
      'ResourceOperationRejectionCode',
      'evaluateCopy',
      'evaluateCreateItem',
      'evaluateMoveToParent',
      'evaluatePermanentDelete',
      'evaluateRestore',
      'evaluateTrash',
      'isResourceOperationPermissionRejection',
    ])
  })

  it('keeps live sharing projection and state assembly inside the editor package boundary', () => {
    const adapterSources = [
      'src/editor-adapters/live/sharing/use-live-blocks-share.ts',
      'src/editor-adapters/live/sharing/use-live-sidebar-items-share.ts',
    ]

    for (const sourcePath of adapterSources) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('createBlocksShareProjection')
      expect(source).not.toContain('createBlocksShareState')
      expect(source).not.toContain('createResourceShareProjection')
      expect(source).not.toContain('createResourceShareState')
    }
  })

  it('keeps create-parent planning private to package command owners', () => {
    const workspaceItemsExports = sortedWorkspaceItemsExports()

    expect(workspaceItemsExports).toEqual(
      expect.arrayContaining(['CREATE_PARENT_TARGET_KIND', 'CreateParentTarget']),
    )
    for (const privateExport of [
      'CreateParentTargetValidationSource',
      'planCreateParentTarget',
      'validateCreateParentTarget',
    ]) {
      expect(workspaceItemsExports).not.toContain(privateExport)
    }
  })

  it('keeps public workspace item leaves in resource vocabulary', () => {
    const workspaceItemsExports = sortedWorkspaceItemsExports()
    const persistenceExports = sortedSourceExports(
      'packages/editor/src/workspace/items-persistence-contract.ts',
    )

    for (const exportName of [...workspaceItemsExports, ...persistenceExports]) {
      expect(exportName).not.toMatch(/SidebarItem|SIDEBAR_ITEM/)
    }
  })

  it('keeps resource row campaign ids domain-owned', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/workspace/resource-contract.ts'),
      'utf8',
    )

    expect(source).toContain('campaignId: CampaignId')
    expect(source).not.toContain('ResourceWorkspaceId')
    expect(source).not.toContain("ResourceTableId<'campaigns'>")
  })

  it('keeps central embed and preview surfaces in resource vocabulary', () => {
    for (const sourcePath of [
      'packages/editor/src/embeds/components/embed-content.tsx',
      'packages/editor/src/embeds/components/canvas-resource-embed-surface.tsx',
      'packages/editor/src/previews/resource-preview-surface.tsx',
      'packages/editor/src/previews/fallback-policy.ts',
    ]) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toMatch(/SidebarItem|sidebar-item/)
    }
  })

  it('keeps resource history state on the history adapter contract', () => {
    expect(sortedPublicApiExports()).not.toContain('./resources/history-preview-session')
    expect(sortedPublicApiExports()).not.toContain('./resources/history')
    expect(publicApiShape.temporaryAdapterConstructionContracts).not.toContain(
      './resources/history',
    )
    expect(sortedAdapterExports()).toEqual(
      expect.arrayContaining([
        'WizardEditorHistoryEntriesInput',
        'WizardEditorHistoryInput',
        'WizardEditorHistoryPreviewInput',
        'WizardEditorHistoryRollbackInput',
        'WizardEditorHistoryScope',
        'WizardEditorHistoryScopeInput',
        'WizardEditorHistorySource',
        'createWizardEditorHistorySource',
        'resolveWizardEditorHistoryScope',
      ]),
    )
  })

  it('keeps history preview session state on the history contract instead of UI store imports', () => {
    for (const sourcePath of [
      'packages/editor/src/filesystem/history.ts',
      'packages/editor/src/filesystem/history-preview/surface.tsx',
      'packages/editor/src/workspace/right-sidebar/runtime-source.ts',
      'packages/editor/src/workspace/sidebar/viewer/content.tsx',
    ]) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('history-preview/store')
    }
  })

  it('keeps backend snapshot rows out of the public history contract', () => {
    expect(sortedHistoryContractExports()).not.toEqual(
      expect.arrayContaining(['HistorySnapshot', 'isHistorySnapshot', 'SNAPSHOT_TYPE']),
    )
    const historyDeclaration = declarationTextForExport('./resources/history-contract')
    const historySource = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/filesystem/history-contract.ts'),
      'utf8',
    )
    expect(historyDeclaration).not.toContain('DocumentSnapshot')
    expect(historyDeclaration).not.toContain('WorkspaceId')
    expect(historyDeclaration).not.toContain('WorkspaceMemberId')
    expect(historyDeclaration).not.toContain('_creationTime')
    expect(historyDeclaration).not.toContain('_id')
    expect(historySource).toContain('CampaignId')
    expect(historySource).toContain('CampaignMemberId')
    expect(declarationTextForExport('./adapter')).not.toContain('CampaignMemberSummary')
  })

  it('keeps live history model construction inside the editor package runtime boundary', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-history.ts'),
      'utf8',
    )
    const runtimeSource = readFileSync(
      path.join(process.cwd(), 'src/editor-adapters/live/use-live-workspace-runtime.ts'),
      'utf8',
    )

    expect(source).not.toContain('SNAPSHOT_TYPE')
    expect(source).not.toContain('readGameMapSnapshot')
    expect(source).not.toContain('createHistoryPreviewState')
    expect(source).not.toContain('createRollbackState')
    expect(source).not.toMatch(/from ['"]@wizard-archive\/editor\/resources\/history['"]/)
    expect(source).not.toContain('@wizard-archive/editor/resources/history-contract')
    expect(source).not.toContain('WorkspaceId')
    expect(source).not.toContain('as WorkspaceId')
    expect(source).not.toContain("campaignId: Id<'campaigns'>")
    expect(source).not.toContain('const { campaign, campaignId } = useCampaign()')
    expect(source).toContain('workspaceRecordId')
    expect(source).toContain('@wizard-archive/editor/adapter')
    expect(runtimeSource).not.toContain('HistoryPreviewSession')
  })

  it('keeps edit history action values derived from the action contract', () => {
    expect(sortedHistoryContractExports()).not.toContain('EDIT_HISTORY_ACTION_VALUES')
  })

  it('keeps bookmark receipt patches item-scoped instead of exposing bookmark rows', () => {
    const source = patchContractSource()

    expect(source).toContain('setResourceBookmarkState')
    expect(source).not.toContain('BookmarkPatchRow')
    expect(source).not.toContain('BookmarkId')
    expect(source).not.toContain('upsertBookmark')
    expect(source).not.toContain('removeBookmark')
  })

  it('keeps note and canvas document contracts free of runtime/provider hooks', () => {
    const sourcePaths = [
      'packages/editor/src/canvas/document-contract.ts',
      'packages/editor/src/canvas/item-contract.ts',
      'packages/editor/src/notes/imported-text.ts',
    ]

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toMatch(/from ['"]react['"]/)
      expect(source).not.toMatch(/from ['"]y-protocols\/awareness['"]/)
      expect(source).not.toMatch(/use[A-Z]\w+/)
    }
  })

  it('keeps the public Yjs provider contract source-neutral and implementation-free', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/collaboration/yjs-provider.ts'),
      'utf8',
    )

    expect(sortedYjsProviderExports()).toEqual([
      'YjsCollaborationProvider',
      'YjsProviderUser',
      'createYjsProviderUser',
    ])
    expect(source).not.toMatch(/from ['"]react['"]/)
    expect(source).not.toContain('useYjsCollaborationSession')
    expect(source).not.toContain('class YjsProvider')
    expect(source).not.toContain('applyYjsProviderRemoteUpdates')
  })

  it('keeps canvas document contracts free of renderer class hooks', () => {
    expect(declarationTextForExport('./canvas/document-contract')).not.toContain('className')
  })

  it('keeps canvas session contracts data-shaped instead of exposing render resolvers', () => {
    const sourcePaths = [
      'packages/editor/src/canvas/workspace-session-source.ts',
      'packages/editor/src/canvas/viewer/source.ts',
      'packages/editor/src/canvas/viewer/runtime-host.tsx',
      'packages/editor/src/canvas/components/canvas-editor-runtime-host.tsx',
    ]

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('EmbeddedCanvasStateResolver')
      expect(source).not.toContain('EmbeddedCanvasStateResolutionProvider')
      expect(source).not.toContain('EmbedResourceResolver')
      expect(source).not.toContain('EmbedResourceResolutionProvider')
    }

    expect(
      existsSync(
        path.join(
          process.cwd(),
          'packages/editor/src/embeds/context/embedded-canvas-state-resolution.ts',
        ),
      ),
    ).toBe(false)
    expect(
      existsSync(
        path.join(
          process.cwd(),
          'packages/editor/src/embeds/context/embedded-map-state-resolution.ts',
        ),
      ),
    ).toBe(false)
  })

  it('keeps filesystem receipt and lifecycle effects resource-shaped instead of route-shaped', () => {
    const sourcePaths = [
      'packages/editor/src/filesystem/executor.ts',
      'packages/editor/src/filesystem/lifecycle-intents.ts',
      'packages/editor/src/filesystem/receipt-effect-planner.ts',
      'packages/editor/src/filesystem/receipt-effects.ts',
    ]

    for (const sourcePath of sourcePaths) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toMatch(/\bcurrentSlug\b/)
      expect(source).not.toMatch(/\bgetCurrentSlug\b/)
      expect(source).not.toMatch(/\bnavigateToItem\b/)
      expect(source).not.toMatch(/\bResourceSlug\b/)
    }
  })

  it('keeps filesystem lifecycle intents workspace-shaped', () => {
    for (const sourcePath of [
      'packages/editor/src/filesystem/domain/lifecycle.ts',
      'packages/editor/src/filesystem/lifecycle-intents.ts',
    ]) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('campaignId')
      expect(source).toContain('workspaceId')
    }
  })

  it('keeps filesystem clipboard intents workspace-shaped', () => {
    for (const sourcePath of [
      'packages/editor/src/filesystem/clipboard.ts',
      'packages/editor/src/filesystem/command-intents.ts',
    ]) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('campaignId')
      expect(source).toContain('workspaceId')
    }
  })

  it('keeps filesystem optimistic command planning workspace-shaped', () => {
    for (const sourcePath of [
      'packages/editor/src/filesystem/command-lifecycle.ts',
      'packages/editor/src/filesystem/optimistic-planner.ts',
    ]) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toContain('campaignId')
      expect(source).toContain('workspaceId')
    }
  })

  it('keeps public media contracts source-neutral instead of storage-shaped', () => {
    for (const subpath of [
      './files/item-contract',
      './game-maps/document-contract',
      './game-maps/image-resolution',
      './game-maps/item-contract',
      './resources/patch-contract',
      './resources/resource-contract',
    ]) {
      const declaration = declarationTextForExport(subpath)
      const source = readFileSync(path.join(process.cwd(), sourcePathForExport(subpath)), 'utf8')

      expect(source).not.toMatch(/\bStorageId\b/)
      expect(source).not.toMatch(/\bstorageId\b/)
      expect(source).not.toMatch(/\bimageStorageId\b/)
      expect(source).not.toMatch(/\bpreviewStorageId\b/)
      expect(declaration).not.toMatch(/\bStorageId\b/)
      expect(declaration).not.toMatch(/\bstorageId\b/)
      expect(declaration).not.toMatch(/\bimageStorageId\b/)
      expect(declaration).not.toMatch(/\bpreviewStorageId\b/)
    }
  })

  it('keeps public resource contracts free of preview lease fields', () => {
    for (const subpath of [
      './canvas/item-contract',
      './files/item-contract',
      './game-maps/item-contract',
      './notes/item-contract',
      './resources/patch-contract',
      './resources/items',
      './resources/resource-contract',
    ]) {
      const declaration = declarationTextForExport(subpath)
      const source = readFileSync(path.join(process.cwd(), sourcePathForExport(subpath)), 'utf8')

      expect(source).not.toMatch(/\bpreviewUpdatedAt\b/)
      expect(declaration).not.toMatch(/\bpreviewUpdatedAt\b/)
    }
  })

  it('keeps note value runtime candidate state distinct from dependency state', () => {
    for (const sourcePath of [
      'packages/editor/src/notes/value-runtime-model.ts',
      'packages/editor/src/notes/value-block/value-block-runtime-context.ts',
    ]) {
      const source = readFileSync(path.join(process.cwd(), sourcePath), 'utf8')

      expect(source).not.toMatch(/\bexternalStates\b/)
      expect(source).not.toMatch(/\bexternalStatesStatus\b/)
      expect(source).toMatch(/\bexternalDependencyStates\b/)
      expect(source).toMatch(/\breferenceableStates\b/)
      expect(source).toMatch(/\breferenceableStatesStatus\b/)
    }
  })

  it('keeps public contracts free of backend row naming', () => {
    for (const subpath of sortedPublicCodeExports()) {
      const declaration = declarationTextForExport(subpath)
      const source = readFileSync(path.join(process.cwd(), sourcePathForExport(subpath)), 'utf8')

      expect(source).not.toMatch(/\b\w*FromDb\w*\b/)
      expect(declaration).not.toMatch(/\b\w*FromDb\w*\b/)
    }
  })

  it('keeps public contracts free of Convex row field names outside persistence leaves', () => {
    for (const subpath of sortedPublicCodeExports()) {
      if (subpath === './resources/items-persistence-contract') continue

      const declaration = declarationTextForExport(subpath)
      const source = readFileSync(path.join(process.cwd(), sourcePathForExport(subpath)), 'utf8')

      expect(source).not.toMatch(/\b_id\b/)
      expect(source).not.toMatch(/\b_creationTime\b/)
      expect(declaration).not.toMatch(/\b_id\b/)
      expect(declaration).not.toMatch(/\b_creationTime\b/)
    }
  })

  it('detects unsafe backend dependencies across import syntaxes', () => {
    const source = [
      "import type { ReactNode } from 'react'",
      "export { BlockNoteView } from '@blocknote/react'",
      "type LazyReactNode = import('react').ReactNode",
      "const blockNote = import('@blocknote/shadcn')",
      "const convex = require('convex/server')",
      "import '~/features/campaigns/campaigns'",
    ].join('\n')

    expect(unsafeBackendDependencySpecifiers('packages/editor/src/example.ts', source)).toEqual([
      'react',
      '@blocknote/react',
      'react',
      '@blocknote/shadcn',
      'convex/server',
      '~/features/campaigns/campaigns',
    ])
  })

  it('keeps backend-safe leaf contracts closed over backend-safe dependencies', () => {
    for (const subpath of publicApiShape.backendSchemaLeafContracts) {
      const dependencies = Array.from(
        collectRelativeEditorDependencies(sourcePathForExport(subpath)),
      )
      for (const dependency of dependencies) {
        const source = readFileSync(path.join(process.cwd(), dependency), 'utf8')
        expect(unsafeBackendDependencySpecifiers(dependency, source)).toEqual([])
      }
    }
  })

  it('keeps the backend-safe subpath authority unique', () => {
    expect(new Set(publicApiShape.backendSchemaLeafContracts).size).toBe(
      publicApiShape.backendSchemaLeafContracts.length,
    )
  })
})
