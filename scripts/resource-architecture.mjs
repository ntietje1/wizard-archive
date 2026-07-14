import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const sourceRules = [
  {
    className: 'provider_or_composite_identity',
    files: /resources\/(domain-id|resource-record)\.ts$/,
    pattern: /ProviderId|providerId|composite(?:Id|Key)|resourceKey|temporaryId|tempId|slug/i,
  },
  {
    className: 'catalog_or_loading_duplication',
    files: /resources\/resource-index-contract\.ts$/,
    pattern: /ensureSubtree|providerCursor|pageToken|operationCoverage|operationId/,
  },
  {
    className: 'undo_or_universal_change_protocol',
    files: /resources\/resource-command-contract\.ts$/,
    pattern: /undo|redo|inverse|emptyTrash|needsDecision|ifMatch|UniversalChange/i,
  },
  {
    className: 'dynamic_or_concurrent_versions',
    files: /resources\/component-version\.ts$/,
    pattern: /codecRegistry|vectorClock|replicaId|concurrent|timestamp/i,
  },
  {
    className: 'everyday_runtime_leakage',
    files: /resources\/editor-runtime-contract\.ts$/,
    pattern:
      /ResourceCatalog|WorkspaceFileSystem|FileSystemPaths|Undo|Transfer|Projector|VersionRegistry|Provider|CopyPreparation/,
  },
  {
    className: 'client_owned_copy_mechanics',
    files: /resources\/content-copy-contract\.ts$/,
    pattern: /optimistic|lease|signed|clientPlan|assetMap|noteBlockMap|pinMap|nodeMap/i,
  },
  {
    className: 'broad_alias_or_guessing',
    files: /resources\/source-path-alias\.ts$/,
    pattern: /currentTitle|frontmatter|slugAlias|routeAlias|proximity|providerOrder/i,
  },
  {
    className: 'alternate_portable_projection',
    files: /resources\/portable-path-(contract|projector)\.ts$/,
    pattern: /Intl\.Segmenter|unicodeTable|readdir|outputDirectory|planDigest/i,
  },
  {
    className: 'overengineered_archive',
    files: /resources\/wizard-archive-(contract|codec|transfer-planner)\.ts$/,
    pattern:
      /attestation|trustClass|selectedResourceArchive|genericMerge|foreignCampaignMerge|manifestDigest|planDigest/i,
  },
  {
    className: 'legacy_convex_schema',
    files: /convex\/(schema|resources\/schema)\.ts$/,
    pattern:
      /sidebarItems|sidebarShares|blockShares|filesystemTransactions|documentSnapshots|editHistory|noteValues|yjsSync/,
  },
]

const forbiddenPaths = [
  /(?:^|\/)sidebarItems(?:\/|$)/,
  /(?:^|\/)sidebarShares(?:\/|$)/,
  /(?:^|\/)blockShares(?:\/|$)/,
  /(?:^|\/)documentSnapshots(?:\/|$)/,
  /(?:^|\/)editHistory(?:\/|$)/,
  /(?:^|\/)yjsSync(?:\/|$)/,
  /use-last-workspace-item\.[tj]sx?$/,
]

const forbiddenExports = new Set([
  './canvas/item-contract',
  './files/import-contract',
  './files/item-contract',
  './game-maps/item-contract',
  './notes/item-contract',
  './notes/values-contract',
  './resources/history-contract',
  './resources/items',
  './resources/items-persistence-contract',
  './resources/operation-capabilities',
  './resources/operation-contract',
  './resources/patch-contract',
  './resources/resource-contract',
  './resources/selection-roots',
  './resources/transaction-contract',
  './sharing',
])

export function analyzeResourceArchitecture(files, packageJson = { exports: {} }) {
  const fileViolations = files.flatMap(analyzeFile)
  const exportViolations = Object.keys(packageJson.exports ?? {})
    .filter((exportPath) => forbiddenExports.has(exportPath))
    .map((exportPath) => ({ className: 'legacy_public_export', path: exportPath }))
  const violations = [...fileViolations, ...exportViolations]
  return violations.sort((left, right) =>
    `${left.className}:${left.path}`.localeCompare(`${right.className}:${right.path}`),
  )
}

function analyzeFile(file) {
  const filePath = file.path.replaceAll('\\', '/')
  const pathViolations = forbiddenPaths
    .filter((pattern) => pattern.test(filePath))
    .map(() => ({ className: 'superseded_module_path', path: filePath }))
  const modelViolations = sourceRules
    .filter((rule) => rule.files.test(filePath) && rule.pattern.test(file.source))
    .map((rule) => ({ className: rule.className, path: filePath }))
  return [...pathViolations, ...modelViolations]
}

export function loadResourceArchitectureInputs(root = process.cwd()) {
  const files = []
  for (const directory of ['convex', 'packages/editor/src', 'src/editor-adapters', 'shared']) {
    collectSourceFiles(root, directory, files)
  }
  const packageJson = JSON.parse(
    readFileSync(path.join(root, 'packages/editor/package.json'), 'utf8'),
  )
  return { files, packageJson }
}

function collectSourceFiles(root, relativeDirectory, files) {
  const directory = path.join(root, relativeDirectory)
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = `${relativeDirectory}/${entry.name}`
    if (entry.isDirectory()) {
      if (entry.name === '_generated' || entry.name === '__tests__') continue
      collectSourceFiles(root, relativePath, files)
    } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      files.push({
        path: relativePath,
        source: readFileSync(path.join(root, relativePath), 'utf8'),
      })
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { files, packageJson } = loadResourceArchitectureInputs()
  const violations = analyzeResourceArchitecture(files, packageJson)
  if (violations.length > 0) {
    console.error(
      violations.map((violation) => `${violation.className}: ${violation.path}`).join('\n'),
    )
    process.exitCode = 1
  }
}
