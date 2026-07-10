import type { CanvasDocumentContent } from '../canvas/document-contract'
import type { CanvasItemWithContent } from '../canvas/item-contract'
import type { FileItemWithContent } from '../files/item-contract'
import type { MapItemWithContent } from '../game-maps/item-contract'
import { deduplicateName } from '../workspace/items'
import type { AnyItem, AnyItemWithContent } from '../workspace/items'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceCatalog } from './catalog'
import type { FileSystemDownloadItem, FileSystemDownloadSkippedItem } from './download'

interface ResourceExportManifest {
  items: Array<FileSystemDownloadItem>
  skippedItems: Array<FileSystemDownloadSkippedItem>
}

interface ResourceExportContentSerializers {
  resolveCanvasDownloadContent: (canvas: CanvasItemWithContent) => CanvasDocumentContent
  resolveFileDownloadUrl: (file: FileItemWithContent) => string | null
  resolveMapDownloadUrl: (map: MapItemWithContent) => string | null
}

type ResourceExportManifestSource = {
  catalog: Pick<ResourceCatalog, 'getVisibleChildren'>
  serializers: ResourceExportContentSerializers
}

type ResourceExportBuildContext = {
  reservedPaths: Set<string>
}

type ResourceExportEntry =
  | { status: 'included'; item: FileSystemDownloadItem }
  | { status: 'skipped'; item: FileSystemDownloadSkippedItem }

const MAX_DEDUP_ATTEMPTS = 100

export function buildResourceExportManifest({
  catalog,
  includeRootFolderName,
  roots,
  serializers,
}: {
  catalog: Pick<ResourceCatalog, 'getVisibleChildren'>
  includeRootFolderName: boolean
  roots: ReadonlyArray<AnyItem>
  serializers: ResourceExportContentSerializers
}): ResourceExportManifest {
  const manifest: ResourceExportManifest = { items: [], skippedItems: [] }
  const context: ResourceExportBuildContext = { reservedPaths: new Set() }
  const source = { catalog, serializers }

  for (const root of roots) {
    appendResourceExportEntries({
      currentPath: '',
      context,
      includeFolderName: includeRootFolderName,
      item: root,
      manifest,
      source,
    })
  }

  return manifest
}

function appendResourceExportEntries({
  currentPath,
  context,
  includeFolderName,
  item,
  manifest,
  source,
}: {
  currentPath: string
  context: ResourceExportBuildContext
  includeFolderName: boolean
  item: AnyItem
  manifest: ResourceExportManifest
  source: ResourceExportManifestSource
}) {
  if (item.type === RESOURCE_TYPES.folders) {
    appendFolderExportEntries({
      currentPath,
      context,
      includeFolderName,
      item,
      manifest,
      source,
    })
    return
  }

  appendNonFolderExportEntry({
    currentPath,
    context,
    item,
    manifest,
    source,
  })
}

function appendFolderExportEntries({
  currentPath,
  context,
  includeFolderName,
  item,
  manifest,
  source,
}: {
  currentPath: string
  context: ResourceExportBuildContext
  includeFolderName: boolean
  item: AnyItem
  manifest: ResourceExportManifest
  source: ResourceExportManifestSource
}) {
  if (!includeFolderName) {
    appendChildExportEntries({
      currentPath,
      context,
      manifest,
      parentId: item.id,
      source,
    })
    return
  }

  const triedNames: Array<string> = []
  for (let attempt = 0; attempt < MAX_DEDUP_ATTEMPTS; attempt += 1) {
    const candidateName = deduplicateName(item.name, triedNames)
    const candidatePath = buildExportPath(currentPath, candidateName)
    const candidateContext = { reservedPaths: new Set(context.reservedPaths) }
    const candidateManifest: ResourceExportManifest = { items: [], skippedItems: [] }
    candidateContext.reservedPaths.add(candidatePath)

    appendChildExportEntries({
      currentPath: candidatePath,
      context: candidateContext,
      manifest: candidateManifest,
      parentId: item.id,
      source,
    })

    if (candidateManifest.items.length === 0 && candidateManifest.skippedItems.length === 0) {
      return
    }
    if (!context.reservedPaths.has(candidatePath)) {
      context.reservedPaths = candidateContext.reservedPaths
      manifest.items.push(...candidateManifest.items)
      manifest.skippedItems.push(...candidateManifest.skippedItems)
      return
    }
    triedNames.push(candidateName)
  }

  throw new Error('Could not generate a unique folder download path')
}

function appendChildExportEntries({
  currentPath,
  context,
  manifest,
  parentId,
  source,
}: {
  currentPath: string
  context: ResourceExportBuildContext
  manifest: ResourceExportManifest
  parentId: SidebarItemId
  source: ResourceExportManifestSource
}) {
  for (const child of source.catalog.getVisibleChildren(parentId)) {
    appendResourceExportEntries({
      currentPath,
      context,
      includeFolderName: true,
      item: child,
      manifest,
      source,
    })
  }
}

function appendNonFolderExportEntry({
  currentPath,
  context,
  item,
  manifest,
  source,
}: {
  currentPath: string
  context: ResourceExportBuildContext
  item: AnyItem
  manifest: ResourceExportManifest
  source: ResourceExportManifestSource
}) {
  const triedNames: Array<string> = []
  for (let attempt = 0; attempt < MAX_DEDUP_ATTEMPTS; attempt += 1) {
    const candidateName = deduplicateName(item.name, triedNames)
    const entry = createResourceExportEntry({
      item,
      path: buildExportPath(currentPath, candidateName),
      serializers: source.serializers,
    })
    const entryPath = entry.item.path
    if (!context.reservedPaths.has(entryPath)) {
      context.reservedPaths.add(entryPath)
      if (entry.status === 'included') {
        manifest.items.push(entry.item)
      } else {
        manifest.skippedItems.push(entry.item)
      }
      return
    }
    triedNames.push(candidateName)
  }

  throw new Error('Could not generate a unique download path')
}

function createResourceExportEntry({
  item,
  path,
  serializers,
}: {
  item: AnyItem
  path: string
  serializers: ResourceExportContentSerializers
}): ResourceExportEntry {
  if (!isDownloadableItemWithContent(item)) {
    return {
      status: 'skipped',
      item: {
        itemId: item.id,
        type: item.type,
        name: item.name,
        path: pathForUnavailableItem(item, path),
        reason: 'content_unavailable',
      },
    }
  }

  switch (item.type) {
    case RESOURCE_TYPES.notes:
      return {
        status: 'included',
        item: {
          type: RESOURCE_TYPES.notes,
          content: item.content,
          name: item.name,
          path: ensureMarkdownPath(path),
        },
      }
    case RESOURCE_TYPES.files:
      return {
        status: 'included',
        item: {
          type: RESOURCE_TYPES.files,
          downloadUrl: serializers.resolveFileDownloadUrl(item),
          name: item.name,
          path,
        },
      }
    case RESOURCE_TYPES.gameMaps:
      return {
        status: 'included',
        item: {
          type: RESOURCE_TYPES.gameMaps,
          downloadUrl: serializers.resolveMapDownloadUrl(item),
          name: item.name,
          path,
        },
      }
    case RESOURCE_TYPES.canvases:
      return {
        status: 'included',
        item: {
          type: RESOURCE_TYPES.canvases,
          content: serializers.resolveCanvasDownloadContent(item),
          name: item.name,
          path: ensureCanvasJsonPath(path),
        },
      }
    default:
      return {
        status: 'skipped',
        item: {
          itemId: item.id,
          type: item.type,
          name: item.name,
          path,
          reason: 'unsupported_type',
        },
      }
  }
}

function pathForUnavailableItem(item: AnyItem, path: string) {
  switch (item.type) {
    case RESOURCE_TYPES.notes:
      return ensureMarkdownPath(path)
    case RESOURCE_TYPES.canvases:
      return ensureCanvasJsonPath(path)
    default:
      return path
  }
}

function buildExportPath(currentPath: string, name: string) {
  return currentPath ? `${currentPath}/${name}` : name
}

function ensureMarkdownPath(path: string) {
  return path.endsWith('.md') ? path : `${path}.md`
}

function ensureCanvasJsonPath(path: string) {
  return path.endsWith('.canvas.json') ? path : `${path}.canvas.json`
}

function isDownloadableItemWithContent(item: AnyItem): item is AnyItemWithContent {
  return 'ancestors' in item && Array.isArray(item.ancestors)
}
