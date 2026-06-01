import { asyncMap } from 'convex-helpers'
import { getCanvasForDownload } from '../../canvases/functions/getCanvasForDownload'
import { getFileForDownload } from '../../files/functions/getFileForDownload'
import { getGameMapForDownload } from '../../gameMaps/functions/getGameMapForDownload'
import { getNoteForDownload } from '../../notes/functions/getNoteForDownload'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { getSidebarItemsByParent } from '../../sidebarItems/functions/getSidebarItemsByParent'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { normalizeSelectedRoots } from '../../../shared/sidebar-items/filesystem/selection'
import { addSidebarItemAncestorsToMap } from '../../sidebarItems/filesystem/ancestors'
import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import { hasAtLeastPermissionLevel } from '../../../shared/permissions/hasAtLeastPermissionLevel'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { assertNever } from '../../common/types'
import { deduplicateName } from '../../../shared/sidebar-items/default-name'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem } from '../../sidebarItems/types/types'
import type { DownloadItem } from '../../sidebarItems/functions/downloadTypes'

type DownloadBuildContext = {
  reservedPaths: Set<string>
}

const MAX_DEDUP_ATTEMPTS = 100
const MAX_DOWNLOAD_ANCESTOR_DEPTH = 50

function buildPath(currentPath: string, name: string) {
  return currentPath ? `${currentPath}/${name}` : name
}

async function buildDownloadItemForSidebarItem(
  ctx: CampaignQueryCtx,
  item: AnySidebarItem,
  path: string,
): Promise<DownloadItem | null> {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.files:
      return await getFileForDownload(ctx, item, path)
    case SIDEBAR_ITEM_TYPES.notes:
      return await getNoteForDownload(ctx, item, path)
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return await getGameMapForDownload(ctx, item, path)
    case SIDEBAR_ITEM_TYPES.canvases:
      return getCanvasForDownload(item, path)
    case SIDEBAR_ITEM_TYPES.folders:
      return null
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
    item: AnySidebarItem
    currentPath: string
    downloadContext: DownloadBuildContext
  },
): Promise<Array<DownloadItem>> {
  const triedNames: Array<string> = []

  for (let attempt = 0; attempt < MAX_DEDUP_ATTEMPTS; attempt += 1) {
    const candidateName = deduplicateName(item.name, triedNames)
    const downloadItem = await buildDownloadItemForSidebarItem(
      ctx,
      item,
      buildPath(currentPath, candidateName),
    )
    if (!downloadItem) return []
    if (!downloadContext.reservedPaths.has(downloadItem.path)) {
      downloadContext.reservedPaths.add(downloadItem.path)
      return [downloadItem]
    }
    triedNames.push(candidateName)
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
    item: Extract<AnySidebarItem, { type: typeof SIDEBAR_ITEM_TYPES.folders }>
    currentPath: string
    includeFolderName: boolean
    downloadContext: DownloadBuildContext
  },
): Promise<Array<DownloadItem>> {
  if (!includeFolderName) {
    return await collectItemsRecursively(ctx, {
      parentId: item._id,
      currentPath,
      downloadContext,
    })
  }

  const triedNames: Array<string> = []
  for (let attempt = 0; attempt < MAX_DEDUP_ATTEMPTS; attempt += 1) {
    const candidateName = deduplicateName(item.name, triedNames)
    const items = await collectItemsRecursively(ctx, {
      parentId: item._id,
      currentPath: buildPath(currentPath, candidateName),
      downloadContext: { reservedPaths: new Set(downloadContext.reservedPaths) },
    })
    if (!hasPathCollision(items, downloadContext.reservedPaths)) {
      reserveDownloadPaths(items, downloadContext.reservedPaths)
      return items
    }
    triedNames.push(candidateName)
  }
  throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Could not generate a unique folder download path')
}

async function collectItemsRecursively(
  ctx: CampaignQueryCtx,
  {
    parentId,
    currentPath,
    downloadContext,
  }: {
    parentId: Id<'sidebarItems'> | null
    currentPath: string
    downloadContext: DownloadBuildContext
  },
): Promise<Array<DownloadItem>> {
  const children = await getSidebarItemsByParent(ctx, { parentId })
  const items: Array<DownloadItem> = []
  const permissionLevels = await asyncMap(children, (child) =>
    getSidebarItemPermissionLevel(ctx, { item: child }),
  )

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const level = permissionLevels[i]
    if (!hasAtLeastPermissionLevel(level, PERMISSION_LEVEL.VIEW)) continue

    if (child.type === SIDEBAR_ITEM_TYPES.folders) {
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
  sourceItemIds: Array<Id<'sidebarItems'>>,
): Promise<{
  sourceItems: Array<AnySidebarItem>
  allItemsMap: Map<Id<'sidebarItems'>, Pick<AnySidebarItem, '_id' | 'parentId'>>
}> {
  const sourceItems = await Promise.all(
    sourceItemIds.map(async (sourceItemId) => {
      const rawItem = await getSidebarItem(ctx, sourceItemId)
      if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Sidebar item not found')
      return await requireItemAccess(ctx, {
        rawItem,
        requiredLevel: PERMISSION_LEVEL.VIEW,
      })
    }),
  )
  const allItemsMap = new Map<Id<'sidebarItems'>, Pick<AnySidebarItem, '_id' | 'parentId'>>()
  for (const item of sourceItems) {
    allItemsMap.set(item._id, item)
  }

  return { sourceItems, allItemsMap }
}

async function collectDownloadItemsForSource(
  ctx: CampaignQueryCtx,
  {
    item,
    includeFolderName,
    downloadContext,
  }: {
    item: AnySidebarItem
    includeFolderName: boolean
    downloadContext: DownloadBuildContext
  },
): Promise<Array<DownloadItem>> {
  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
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
  sourceItemIds: Array<Id<'sidebarItems'>>,
): Promise<{ items: Array<DownloadItem> }> {
  if (sourceItemIds.length === 0) return { items: [] }

  const { sourceItems, allItemsMap } = await getDownloadSourceItems(ctx, sourceItemIds)
  await addSidebarItemAncestorsToMap(ctx, {
    items: sourceItems,
    itemsById: allItemsMap,
    maxDepth: MAX_DOWNLOAD_ANCESTOR_DEPTH,
  })
  const normalizedItems = normalizeSelectedRoots(sourceItems, allItemsMap)
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
