import { getSidebarItemsByParent } from '../../sidebarItems/functions/getSidebarItemsByParent'
import { getTopLevelBlocksByNote } from '../../blocks/blocks'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { requireItemAccess } from '../../sidebarItems/validation'
import {
  getSidebarItemPermissionLevel,
  hasAtLeastPermissionLevel,
} from '../../shares/itemShares'
import { enforceBlockSharePermissionsOrNull } from '../../shares/blockShares'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { CampaignQueryCtx } from '../../functions'
import type { CustomBlock } from '../../notes/editorSpecs'
import type { Id } from '../../_generated/dataModel'

export type DownloadItem =
  | {
      type: typeof SIDEBAR_ITEM_TYPES.files | typeof SIDEBAR_ITEM_TYPES.gameMaps
      name: string
      path: string
      downloadUrl: string | null
    }
  | {
      type: typeof SIDEBAR_ITEM_TYPES.notes
      name: string
      path: string
      content: Array<CustomBlock>
    }

async function collectItemsRecursively(
  ctx: CampaignQueryCtx,
  {
    parentId,
    currentPath,
  }: { parentId: Id<'folders'> | undefined; currentPath: string },
): Promise<Array<DownloadItem>> {
  const children = await getSidebarItemsByParent(ctx, { parentId })
  const items: Array<DownloadItem> = []

  for (const child of children) {
    const level = await getSidebarItemPermissionLevel(ctx, { item: child })
    if (!hasAtLeastPermissionLevel(level, PERMISSION_LEVEL.VIEW)) continue

    if (child.type === SIDEBAR_ITEM_TYPES.files) {
      const fileName = child.name
      const downloadUrl = child.storageId
        ? await ctx.storage.getUrl(child.storageId)
        : null
      items.push({
        type: SIDEBAR_ITEM_TYPES.files,
        name: fileName,
        path: currentPath ? `${currentPath}/${fileName}` : fileName,
        downloadUrl,
      })
    } else if (child.type === SIDEBAR_ITEM_TYPES.notes) {
      const baseName = child.name
      const noteName = baseName.endsWith('.md') ? baseName : `${baseName}.md`
      const topLevelBlocks = await getTopLevelBlocksByNote(ctx, {
        noteId: child._id,
      })
      const visibleBlocks = await Promise.all(
        topLevelBlocks.map((block) =>
          enforceBlockSharePermissionsOrNull(ctx, { block }),
        ),
      )
      const content = visibleBlocks
        .filter((block) => block !== null)
        .map((block) => block.content)
      items.push({
        type: SIDEBAR_ITEM_TYPES.notes,
        name: noteName,
        path: currentPath ? `${currentPath}/${noteName}` : noteName,
        content,
      })
    } else if (child.type === SIDEBAR_ITEM_TYPES.gameMaps) {
      const mapName = child.name
      const downloadUrl = child.imageStorageId
        ? await ctx.storage.getUrl(child.imageStorageId)
        : null
      items.push({
        type: SIDEBAR_ITEM_TYPES.gameMaps,
        name: mapName,
        path: currentPath ? `${currentPath}/${mapName}` : mapName,
        downloadUrl,
      })
    } else if (child.type === SIDEBAR_ITEM_TYPES.folders) {
      const folderName = child.name
      const nestedPath = currentPath
        ? `${currentPath}/${folderName}`
        : folderName
      const nestedItems = await collectItemsRecursively(ctx, {
        parentId: child._id,
        currentPath: nestedPath,
      })
      items.push(...nestedItems)
    } else {
      throw new Error(`Unknown item type`)
    }
  }

  return items
}

export async function getFolderContentsForDownload(
  ctx: CampaignQueryCtx,
  folderId: Id<'folders'>,
): Promise<{ folderName: string; items: Array<DownloadItem> }> {
  const folderFromDb = await ctx.db.get(folderId)
  const folder = await requireItemAccess(ctx, {
    rawItem: folderFromDb,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const folderName = folder.name
  const items = await collectItemsRecursively(ctx, {
    parentId: folderId,
    currentPath: '',
  })

  return { folderName, items }
}

export async function getRootContentsForDownload(
  ctx: CampaignQueryCtx,
): Promise<{ items: Array<DownloadItem> }> {
  const items = await collectItemsRecursively(ctx, {
    parentId: undefined,
    currentPath: '',
  })
  return { items }
}
