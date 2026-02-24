import { defaultItemName } from '../../sidebarItems/functions/defaultItemName'
import { getSidebarItemsByParent } from '../../sidebarItems/functions/getSidebarItemsByParent'
import { getTopLevelBlocksByNote } from '../../blocks/blocks'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { CampaignQueryCtx } from '../../functions'
import type { DownloadableItem } from '../types'
import type { Id } from '../../_generated/dataModel'

async function collectItemsRecursively(
  ctx: CampaignQueryCtx,
  {
    parentId,
    currentPath,
  }: { parentId: Id<'folders'> | undefined; currentPath: string },
): Promise<Array<DownloadableItem>> {
  const children = await getSidebarItemsByParent(ctx, { parentId })
  const items: Array<DownloadableItem> = []

  for (const child of children) {
    if (child.type === SIDEBAR_ITEM_TYPES.files) {
      const fileName = child.name ?? defaultItemName(child)
      const downloadUrl = child.storageId
        ? await ctx.storage.getUrl(child.storageId)
        : null
      items.push({
        type: SIDEBAR_ITEM_TYPES.files,
        id: child._id,
        name: fileName,
        path: currentPath ? `${currentPath}/${fileName}` : fileName,
        downloadUrl,
      })
    } else if (child.type === SIDEBAR_ITEM_TYPES.notes) {
      const baseName = child.name ?? defaultItemName(child)
      const noteName = baseName.endsWith('.md') ? baseName : `${baseName}.md`
      const topLevelBlocks = await getTopLevelBlocksByNote(ctx, {
        noteId: child._id,
      })
      const content = topLevelBlocks.map((block) => block.content)
      items.push({
        type: SIDEBAR_ITEM_TYPES.notes,
        id: child._id,
        name: noteName,
        path: currentPath ? `${currentPath}/${noteName}` : noteName,
        content,
      })
    } else if (child.type === SIDEBAR_ITEM_TYPES.gameMaps) {
      const mapName = child.name ?? defaultItemName(child)
      const downloadUrl = child.imageStorageId
        ? await ctx.storage.getUrl(child.imageStorageId)
        : null
      items.push({
        type: SIDEBAR_ITEM_TYPES.gameMaps,
        id: child._id,
        name: mapName,
        path: currentPath ? `${currentPath}/${mapName}` : mapName,
        downloadUrl,
      })
    } else if (child.type === SIDEBAR_ITEM_TYPES.folders) {
      const folderName = child.name ?? defaultItemName(child)
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
): Promise<{ folderName: string; items: Array<DownloadableItem> }> {
  const folderFromDb = await ctx.db.get(folderId)
  const folder = await requireItemAccess(ctx, {
    rawItem: folderFromDb,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  const folderName = folder.name ?? defaultItemName(folder)
  const items = await collectItemsRecursively(ctx, {
    parentId: folderId,
    currentPath: '',
  })

  return { folderName, items }
}

export async function getRootContentsForDownload(
  ctx: CampaignQueryCtx,
): Promise<{ items: Array<DownloadableItem> }> {
  const items = await collectItemsRecursively(ctx, {
    parentId: undefined,
    currentPath: '',
  })
  return { items }
}
