import { v } from 'convex/values'
import { query } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import {
  defaultItemName,
  getSidebarItemsByParent,
} from '../sidebarItems/sidebarItems'
import { getTopLevelBlocksByNote } from '../blocks/blocks'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { getFolder as getFolderFn } from './folders'
import { downloadableItemValidator, folderValidator } from './schema'
import type { DownloadableItem, Folder } from './types'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

export const getFolder = query({
  args: {
    folderId: v.id('folders'),
  },
  returns: folderValidator,
  handler: async (ctx, args): Promise<Folder> => {
    const folder = await getFolderFn(ctx, args.folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }
    return folder
  },
})

async function collectItemsRecursively(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  parentId: Id<'folders'> | undefined,
  currentPath: string,
): Promise<Array<DownloadableItem>> {
  const children = await getSidebarItemsByParent(ctx, campaignId, parentId)
  const items: Array<DownloadableItem> = []

  for (const child of children) {
    if (child.type === SIDEBAR_ITEM_TYPES.files) {
      const fileName = child.name ?? defaultItemName(child)
      const downloadUrl = await ctx.storage.getUrl(child.storageId)
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

export const getFolderContentsForDownload = query({
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
    const folder = await ctx.db.get(args.folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: folder.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    const folderName = folder.name ?? defaultItemName(folder)
    const items = await collectItemsRecursively(
      ctx,
      folder.campaignId,
      args.folderId,
      '',
    )

    return { folderName, items }
  },
})

export const getRootContentsForDownload = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.object({
    items: v.array(downloadableItemValidator),
  }),
  handler: async (ctx, args) => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    const items = await collectItemsRecursively(
      ctx,
      args.campaignId,
      undefined,
      '',
    )

    return { items }
  },
})
