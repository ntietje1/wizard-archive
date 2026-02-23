import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { deleteFile } from '../files/files'
import { deleteMap } from '../gameMaps/gameMaps'
import { deleteNote } from '../notes/notes'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { checkItemAccess } from '../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../shares/types'
import { deleteSidebarItemShares } from '../shares/itemShares'
import { deleteItemBookmarks } from '../bookmarks/functions/deleteItemBookmarks'
import { enhanceFolderWithContent } from './helpers'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'
import type { Id } from '../_generated/dataModel'
import type { Folder, FolderWithContent } from './types'

export const getFolder = async (
  ctx: CampaignQueryCtx,
  folderId: Id<'folders'>,
): Promise<FolderWithContent | null> => {
  const rawFolder = await ctx.db.get(folderId)
  const folder = await checkItemAccess(ctx, rawFolder, PERMISSION_LEVEL.VIEW)
  if (!folder) return null
  return enhanceFolderWithContent(ctx, folder)
}

export async function deleteFolder(
  ctx: CampaignMutationCtx,
  folderId: Id<'folders'>,
): Promise<Id<'folders'>> {
  const rawFolder = await ctx.db.get(folderId)
  if (!rawFolder) {
    throw new Error('Folder not found')
  }

  // folders specifically require DM level to delete rather than full access
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    throw new Error('Only the DM can delete folders')
  }

  const campaignId = ctx.campaign._id

  const childFolders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', folderId),
    )
    .collect()

  for (const childFolder of childFolders) {
    await deleteFolder(ctx, childFolder._id)
  }

  const childNotes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', folderId),
    )
    .collect()

  for (const childNote of childNotes) {
    await deleteNote(ctx, childNote._id)
  }

  const childMaps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', folderId),
    )
    .collect()

  for (const childMap of childMaps) {
    await deleteMap(ctx, childMap._id)
  }

  const childFiles = await ctx.db
    .query('files')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('parentId', folderId),
    )
    .collect()

  for (const childFile of childFiles) {
    await deleteFile(ctx, childFile._id)
  }

  await deleteSidebarItemShares(ctx, folderId)
  await deleteItemBookmarks(ctx, folderId)
  await ctx.db.delete(folderId)

  return folderId
}

export async function getSidebarItemAncestors(
  ctx: CampaignQueryCtx,
  initialParentId: Id<'folders'> | undefined,
): Promise<Array<Folder>> {
  const ancestors: Array<Folder> = []
  let currentParentId = initialParentId

  while (currentParentId) {
    const rawFolder = await ctx.db.get(currentParentId)
    if (!rawFolder) {
      break
    }
    const folder = await enhanceSidebarItem(ctx, rawFolder)

    ancestors.unshift(folder)
    currentParentId = folder.parentId
  }

  return ancestors
}
