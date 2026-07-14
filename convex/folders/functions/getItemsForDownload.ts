import { getCanvasForDownload } from '../../canvases/functions/getCanvasForDownload'
import { getFileForDownload } from '../../files/functions/getFileForDownload'
import { getGameMapForDownload } from '../../gameMaps/functions/getGameMapForDownload'
import { getNoteForDownload } from '../../notes/functions/getNoteForDownload'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { getSidebarItemsByParent } from '../../sidebarItems/functions/getSidebarItemsByParent'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type {
  AnyResource,
  FolderResource,
} from '@wizard-archive/editor/resources/resource-contract'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { findSidebarItemRow } from '../../sidebarItems/functions/sidebarItemIdentity'
import { normalizeSelectedRoots } from '@wizard-archive/editor/resources/selection-roots'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { assertNever } from '../../common/types'
import type { CampaignQueryCtx } from '../../functions'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { DownloadItem } from '../../sidebarItems/functions/downloadTypes'

type DownloadBuildContext = {
  reservedPaths: Set<string>
}

type DownloadableSidebarItem = Exclude<AnyResource, FolderResource>

const MAX_DOWNLOAD_ANCESTOR_DEPTH = 50

function buildPath(currentPath: string, name: string) {
  return currentPath ? `${currentPath}/${name}` : name
}

async function buildDownloadItemForSidebarItem(
  ctx: CampaignQueryCtx,
  item: DownloadableSidebarItem,
  path: string,
): Promise<DownloadItem> {
  switch (item.type) {
    case RESOURCE_TYPES.files:
      return await getFileForDownload(ctx, item, path)
    case RESOURCE_TYPES.notes:
      return await getNoteForDownload(ctx, item, path)
    case RESOURCE_TYPES.gameMaps:
      return await getGameMapForDownload(ctx, item, path)
    case RESOURCE_TYPES.canvases:
      return await getCanvasForDownload(ctx, item, path)
    default:
      assertNever(item)
  }
}

function hasPathCollision(items: Array<DownloadItem>, reservedPaths: Set<string>) {
  return items.some((item) => reservedPaths.has(item.path))
}

function reserveDownloadPaths(items: Array<DownloadItem>, reservedPaths: Set<string>) {
  for (const item of items) {
    reservedPaths.add(item.path)
  }
}

async function collectNonFolderDownloadItem(
  ctx: CampaignQueryCtx,
  {
    item,
    currentPath,
    downloadContext,
  }: {
    item: DownloadableSidebarItem
    currentPath: string
    downloadContext: DownloadBuildContext
  },
): Promise<Array<DownloadItem>> {
  for (const candidateName of projectedNameCandidates(item)) {
    const downloadItem = await buildDownloadItemForSidebarItem(
      ctx,
      item,
      buildPath(currentPath, candidateName),
    )
    if (!downloadContext.reservedPaths.has(downloadItem.path)) {
      downloadContext.reservedPaths.add(downloadItem.path)
      return [downloadItem]
    }
  }
  throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Could not generate a unique download path')
}

async function collectFolderDownloadItems(
  ctx: CampaignQueryCtx,
  {
    item,
    currentPath,
    includeFolderName,
    downloadContext,
  }: {
    item: FolderResource
    currentPath: string
    includeFolderName: boolean
    downloadContext: DownloadBuildContext
  },
): Promise<Array<DownloadItem>> {
  if (!includeFolderName) {
    return await collectItemsRecursively(ctx, {
      parentId: item.id,
      currentPath,
      downloadContext,
    })
  }

  for (const candidateName of projectedNameCandidates(item)) {
    const items = await collectItemsRecursively(ctx, {
      parentId: item.id,
      currentPath: buildPath(currentPath, candidateName),
      downloadContext: { reservedPaths: new Set(downloadContext.reservedPaths) },
    })
    if (!hasPathCollision(items, downloadContext.reservedPaths)) {
      reserveDownloadPaths(items, downloadContext.reservedPaths)
      return items
    }
  }
  throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Could not generate a unique folder download path')
}

function projectedNameCandidates(item: AnyResource): [string, string] {
  return [item.name, `${item.name}~${item.id.slice(-8)}`]
}

async function collectItemsRecursively(
  ctx: CampaignQueryCtx,
  {
    parentId,
    currentPath,
    downloadContext,
  }: {
    parentId: ResourceId | null
    currentPath: string
    downloadContext: DownloadBuildContext
  },
): Promise<Array<DownloadItem>> {
  const children = await getSidebarItemsByParent(ctx, { parentId })
  const items: Array<DownloadItem> = []

  for (const child of children) {
    if (child.type === RESOURCE_TYPES.folders) {
      items.push(
        ...(await collectFolderDownloadItems(ctx, {
          item: child,
          currentPath,
          includeFolderName: true,
          downloadContext,
        })),
      )
      continue
    }

    items.push(
      ...(await collectNonFolderDownloadItem(ctx, {
        item: child,
        currentPath,
        downloadContext,
      })),
    )
  }

  return items
}

export async function getRootContentsForDownload(
  ctx: CampaignQueryCtx,
): Promise<{ items: Array<DownloadItem> }> {
  const items = await collectItemsRecursively(ctx, {
    parentId: null,
    currentPath: '',
    downloadContext: { reservedPaths: new Set() },
  })
  return { items }
}

async function getDownloadSourceItems(
  ctx: CampaignQueryCtx,
  sourceItemIds: Array<ResourceId>,
): Promise<{
  sourceItems: Array<AnyResource>
  allItemsMap: Map<ResourceId, Pick<AnyResource, 'id' | 'parentId'>>
}> {
  const sourceItems = await Promise.all(
    sourceItemIds.map(async (sourceItemId) => {
      const row = await findSidebarItemRow(ctx, sourceItemId)
      const rawItem = row ? await getSidebarItem(ctx, row._id) : null
      if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Sidebar item not found')
      return await requireItemAccess(ctx, {
        rawItem,
        requiredLevel: PERMISSION_LEVEL.VIEW,
      })
    }),
  )
  const allItemsMap = new Map<ResourceId, Pick<AnyResource, 'id' | 'parentId'>>()
  for (const item of sourceItems) {
    allItemsMap.set(item.id, item)
  }

  return { sourceItems, allItemsMap }
}

async function loadDownloadAncestorMap(
  ctx: CampaignQueryCtx,
  sourceItems: Array<AnyResource>,
  allItemsMap: Map<ResourceId, Pick<AnyResource, 'id' | 'parentId'>>,
) {
  for (const sourceItem of sourceItems) {
    let parentId = sourceItem.parentId
    let depth = 0
    while (parentId) {
      if (depth >= MAX_DOWNLOAD_ANCESTOR_DEPTH) {
        throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar ancestor depth exceeded')
      }
      const existingParent = allItemsMap.get(parentId)
      if (existingParent) {
        parentId = existingParent.parentId
        depth += 1
        continue
      }
      const row = await findSidebarItemRow(ctx, parentId)
      const parent = row ? await getSidebarItem(ctx, row._id) : null
      if (!parent) {
        throwClientError(ERROR_CODE.NOT_FOUND, 'Sidebar item ancestor not found')
      }
      allItemsMap.set(parent.id, parent)
      parentId = parent.parentId
      depth += 1
    }
  }
  return allItemsMap
}

async function collectDownloadItemsForSource(
  ctx: CampaignQueryCtx,
  {
    item,
    includeFolderName,
    downloadContext,
  }: {
    item: AnyResource
    includeFolderName: boolean
    downloadContext: DownloadBuildContext
  },
): Promise<Array<DownloadItem>> {
  if (item.type === RESOURCE_TYPES.folders) {
    return await collectFolderDownloadItems(ctx, {
      item,
      currentPath: '',
      includeFolderName,
      downloadContext,
    })
  }

  return await collectNonFolderDownloadItem(ctx, {
    item,
    currentPath: '',
    downloadContext,
  })
}

export async function getSidebarItemsForDownload(
  ctx: CampaignQueryCtx,
  sourceItemIds: Array<ResourceId>,
): Promise<{ items: Array<DownloadItem> }> {
  if (sourceItemIds.length === 0) return { items: [] }

  const { sourceItems, allItemsMap } = await getDownloadSourceItems(ctx, sourceItemIds)
  const ancestorItemsById = await loadDownloadAncestorMap(ctx, sourceItems, allItemsMap)
  const normalizedItems = normalizeSelectedRoots(sourceItems, ancestorItemsById)
  const items: Array<DownloadItem> = []
  const downloadContext: DownloadBuildContext = { reservedPaths: new Set() }

  for (const item of normalizedItems) {
    items.push(
      ...(await collectDownloadItemsForSource(ctx, {
        item,
        includeFolderName: normalizedItems.length > 1,
        downloadContext,
      })),
    )
  }

  return { items }
}
