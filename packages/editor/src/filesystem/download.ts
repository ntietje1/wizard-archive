import type { ResourceId } from '../resources/domain-id'
import type { CanvasDocumentContent } from '../canvas/document-contract'
import type { CanvasItemWithContent } from '../canvas/item-contract'
import type { FileItemWithContent } from '../files/item-contract'
import type { MapItemWithContent } from '../game-maps/item-contract'
import type { NoteBlock } from '../notes/document/model'
import type { AnyItem } from '../workspace/items'
import type { RESOURCE_TYPES } from '../workspace/items-persistence-contract'

import { buildResourceExportManifest } from './resource-export-manifest'
import type { ResourceCatalog, ResourceOperationItems } from './catalog'
import type { ResourceOperationReceipt } from './transaction-contract'

type NoteBlocksContent = Array<NoteBlock>

export type FileSystemDownloadItem =
  | {
      type: typeof RESOURCE_TYPES.files | typeof RESOURCE_TYPES.gameMaps
      downloadUrl: string | null
      name: string
      path: string
    }
  | {
      type: typeof RESOURCE_TYPES.notes
      content: NoteBlocksContent
      name: string
      path: string
    }
  | {
      type: typeof RESOURCE_TYPES.canvases
      content: CanvasDocumentContent
      name: string
      path: string
    }

export interface FileSystemDownloadSkippedItem {
  itemId: ResourceId
  type: AnyItem['type']
  name: string
  path: string
  reason: 'content_unavailable' | 'path_conflict' | 'unsupported_type'
}

export type FileSystemDownload =
  | {
      status: 'available'
      loadItemsForDownload: (input: {
        itemIds: ReadonlyArray<ResourceId>
        items?: ReadonlyArray<AnyItem>
      }) => Promise<FileSystemDownloadResult>
      loadRootItemsForDownload: () => Promise<FileSystemDownloadResult>
    }
  | {
      status: 'unsupported'
      reason: 'not_available'
    }

export type FileSystemDownloadResult =
  | {
      status: 'completed'
      receipt: ResourceOperationReceipt & { kind: 'downloadPrepared' }
      items: Array<FileSystemDownloadItem>
      skippedItems: Array<FileSystemDownloadSkippedItem>
    }
  | { status: 'unsupported'; reason: string; items: [] }
  | { status: 'unavailable'; reason: string; items: [] }
  | { status: 'error'; error?: unknown; items: [] }

type CatalogFileSystemDownloadInput = {
  catalog: Pick<ResourceCatalog, 'getVisibleChildren' | 'getVisibleRoots'>
  operationItems: ResourceOperationItems
  resolveCanvasDownloadContent: (canvas: CanvasItemWithContent) => CanvasDocumentContent
  resolveFileDownloadUrl: (file: FileItemWithContent) => string | null
  resolveMapDownloadUrl: (map: MapItemWithContent) => string | null
}

export function createCatalogFileSystemDownload({
  catalog,
  operationItems,
  resolveCanvasDownloadContent,
  resolveFileDownloadUrl,
  resolveMapDownloadUrl,
}: CatalogFileSystemDownloadInput): FileSystemDownload {
  const buildItems = ({
    includeRootFolderName,
    roots,
  }: {
    includeRootFolderName: boolean
    roots: ReadonlyArray<AnyItem>
  }): FileSystemDownloadResult => {
    const manifest = buildResourceExportManifest({
      catalog,
      includeRootFolderName,
      roots,
      serializers: {
        resolveCanvasDownloadContent,
        resolveFileDownloadUrl,
        resolveMapDownloadUrl,
      },
    })
    return {
      status: 'completed',
      receipt: { kind: 'downloadPrepared', affectedCount: manifest.items.length },
      items: manifest.items,
      skippedItems: manifest.skippedItems,
    }
  }

  return {
    status: 'available',
    loadItemsForDownload: ({ itemIds, items }) =>
      Promise.resolve()
        .then(() => {
          const roots = resolveSelectedDownloadRoots({ itemIds, items, operationItems })
          return buildItems({ includeRootFolderName: roots.length > 1, roots })
        })
        .catch((error: unknown) => ({ status: 'error', error, items: [] })),
    loadRootItemsForDownload: () =>
      Promise.resolve()
        .then(() => buildItems({ includeRootFolderName: true, roots: catalog.getVisibleRoots() }))
        .catch((error: unknown) => ({ status: 'error', error, items: [] })),
  }
}

function resolveSelectedDownloadRoots({
  itemIds,
  items,
  operationItems,
}: {
  itemIds: ReadonlyArray<ResourceId>
  items: ReadonlyArray<AnyItem> | undefined
  operationItems: ResourceOperationItems
}) {
  if (!items?.length) {
    return operationItems.resolveItems({ itemIds, includeTrashed: false })
  }

  const itemsById = new Map(items.map((item) => [item.id, item]))
  const fallbackItems = operationItems.resolveItems({ itemIds, includeTrashed: false })
  const fallbackItemsById = new Map(fallbackItems.map((item) => [item.id, item]))
  return itemIds.flatMap((itemId) => {
    const fallback = fallbackItemsById.get(itemId)
    if (!fallback) return []
    const supplied = itemsById.get(itemId)
    return supplied?.status === fallback.status ? supplied : fallback
  })
}
