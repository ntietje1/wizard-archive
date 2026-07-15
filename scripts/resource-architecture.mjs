import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadSourceFiles } from './source-files.mjs'

const sourceRules = [
  {
    className: 'legacy_editor_vocabulary',
    files: /^packages\/editor\/src\//,
    pattern:
      /FileSystem\w*|SidebarItem\w*|SIDEBAR_ITEM\w*|AllPlayers\w*|initialItemId|navigateToItem|sidebarSlots|sidebarSort|showSidebar|ResourceShellSort|[?&]item=/,
  },
  {
    className: 'provider_identity_leakage',
    files: /^packages\/editor\/src\//,
    pattern: /\b(?:SharedId|SessionRowId|WorkspaceMemberId|authUserId|storageId|_id)\b|\bId\s*</,
  },
  {
    className: 'unchecked_domain_id_cast',
    files: /^(?:convex|packages\/editor\/src|shared|src)\//,
    pattern:
      /\bas (?:AssetId|CampaignId|CampaignMemberId|CanvasNodeId|HistoryEntryId|ImportJobId|MapPinId|NoteBlockId|OperationId|ResourceId|SessionId|SnapshotId|UserProfileId)\b/,
  },
  {
    className: 'pre_cutover_compatibility',
    files: /^packages\/editor\/src\//,
    pattern: /migrateLegacy|stripLegacy|LegacyMedia|createLegacy/,
  },
  {
    className: 'adapter_owned_content_state',
    files: /src\/editor-adapters\/live\/resources\/resource-watch-store\.ts$/,
    pattern: /\b(?:states|listeners)\s*=\s*new Map<ResourceId,/,
  },
  {
    className: 'provider_or_composite_identity',
    files: /resources\/(domain-id|resource-record)\.ts$/,
    pattern:
      /ProviderId|providerId|composite(?:Id|Key)|resourceKey|temporaryId|tempId|slug|exportJob|resourceShare/i,
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
      /ResourceCatalog|WorkspaceFileSystem|FileSystemPaths|UniversalUndo|UndoGateway|UndoService|Transfer|Projector|VersionRegistry|Provider|CopyPreparation/,
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
  /packages\/editor\/src\/filesystem(?:\/|$)/,
  /packages\/editor\/src\/notes\/document\/legacy-media-migration\.[tj]s$/,
  /(?:^|\/)sidebarItems(?:\/|$)/,
  /(?:^|\/)sidebarShares(?:\/|$)/,
  /(?:^|\/)blockShares(?:\/|$)/,
  /(?:^|\/)documentSnapshots(?:\/|$)/,
  /(?:^|\/)editHistory(?:\/|$)/,
  /(?:^|\/)yjsSync(?:\/|$)/,
  /use-last-workspace-item\.[tj]sx?$/,
]

const forbiddenExportPatterns = [/^\.\/filesystem(?:\/|$)/]

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
    .filter(
      (exportPath) =>
        forbiddenExports.has(exportPath) ||
        forbiddenExportPatterns.some((pattern) => pattern.test(exportPath)),
    )
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
  const files = loadSourceFiles(
    root,
    ['convex', 'packages/editor/src', 'src/editor-adapters', 'shared'],
    { skippedDirectories: ['_generated', '__tests__'] },
  )
  const packageJson = JSON.parse(
    readFileSync(path.join(root, 'packages/editor/package.json'), 'utf8'),
  )
  return { files, packageJson }
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
