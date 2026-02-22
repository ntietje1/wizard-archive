import { v } from 'convex/values'
import {
  defaultItemName,
  getSidebarItemsByParent,
} from '../sidebarItems/sidebarItems'
import { getTopLevelBlocksByNote } from '../blocks/blocks'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { requireEditPermission } from '../shares/itemShares'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { dmQuery } from '../functions'
import { downloadableItemValidator } from './schema'
import type { CampaignQueryCtx } from '../functions'
import type { DownloadableItem } from './types'
import type { Id } from '../_generated/dataModel'

async function collectItemsRecursively(
  ctx: CampaignQueryCtx,
  campaignId: Id<'campaigns'>,
  parentId: Id<'folders'> | undefined,
  currentPath: string,
): Promise<Array<DownloadableItem>> {
  const children = await getSidebarItemsByParent(ctx, campaignId, parentId)
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
      const topLevelBlocks = await getTopLevelBlocksByNote(
        ctx,
        child._id,
        campaignId,
      )
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
      const nestedItems = await collectItemsRecursively(
        ctx,
        campaignId,
        child._id,
        nestedPath,
      )
      items.push(...nestedItems)
    } else {
      throw new Error(`Unknown item type, ${child}`)
    }
  }

  return items
}

export const getFolderContentsForDownload = dmQuery({
  args: {
    folderId: v.id('folders'),
  },
  returns: v.object({
    folderName: v.string(),
    items: v.array(downloadableItemValidator),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ folderName: string; items: Array<DownloadableItem> }> => {
    const folderFromDb = await ctx.db.get(args.folderId)
    if (!folderFromDb || folderFromDb.campaignId !== args.campaignId) {
      throw new Error('Folder not found')
    }

    const folder = await enhanceSidebarItem(ctx, folderFromDb)
    await requireEditPermission(ctx, folder)

    const folderName = folder.name ?? defaultItemName(folder)
    const items = await collectItemsRecursively(
      ctx,
      args.campaignId,
      args.folderId,
      '',
    )

    return { folderName, items }
  },
})

export const getRootContentsForDownload = dmQuery({
  returns: v.object({
    items: v.array(downloadableItemValidator),
  }),
  handler: async (ctx, args) => {
    const items = await collectItemsRecursively(
      ctx,
      args.campaignId,
      undefined,
      '',
    )

    return { items }
  },
})
