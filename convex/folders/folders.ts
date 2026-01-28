import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { pipe } from '../common/pipeline'
import { deleteNote } from '../notes/notes'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { enhanceFolderWithContent } from './helpers'
import type { Ctx } from '../common/types'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import type { Folder, FolderWithContent } from './types'

export const getFolder = async (
  ctx: Ctx,
  folderId: Id<'folders'>,
  viewAsPlayerId?: Id<'campaignMembers'>,
): Promise<FolderWithContent | null> => {
  const rawFolder = await ctx.db.get(folderId)
  if (!rawFolder) return null

  return pipe(ctx, rawFolder)
    .pipe(enhanceSidebarItem)
    .pipe((ctx, folder) =>
      enhanceFolderWithContent(ctx, folder, viewAsPlayerId),
    )
    .run()
}

export async function deleteFolder(
  ctx: MutationCtx,
  folderId: Id<'folders'>,
): Promise<Id<'folders'>> {
  const folder = await ctx.db.get(folderId)
  if (!folder) {
    throw new Error('Folder not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: folder.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  // Cascade delete all children
  // First, delete child folders (recursively)
  const childFolders = await ctx.db
    .query('folders')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', folder.campaignId).eq('parentId', folderId),
    )
    .collect()

  for (const childFolder of childFolders) {
    await deleteFolder(ctx, childFolder._id)
  }

  // Delete child notes
  const childNotes = await ctx.db
    .query('notes')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', folder.campaignId).eq('parentId', folderId),
    )
    .collect()

  for (const childNote of childNotes) {
    await deleteNote(ctx, childNote._id)
  }

  // Delete child maps
  const childMaps = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_parent_name', (q) =>
      q.eq('campaignId', folder.campaignId).eq('parentId', folderId),
    )
    .collect()

  for (const childMap of childMaps) {
    // Delete map pins first
    const pins = await ctx.db
      .query('mapPins')
      .withIndex('by_map_item', (q) => q.eq('mapId', childMap._id))
      .collect()

    for (const pin of pins) {
      await ctx.db.delete(pin._id)
    }

    await ctx.db.delete(childMap._id)
  }

  await ctx.db.delete(folderId)

  return folderId
}

export async function getSidebarItemAncestors(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  initialParentId: Id<'folders'> | undefined,
): Promise<Array<Folder>> {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

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
