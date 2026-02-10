import {
  getSidebarItemPermissionLevel,
  getSidebarItemSharesForItem,
} from '../shares/itemShares'
import { getBookmark } from '../bookmarks/bookmarks'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getSidebarItemsByParent } from '../sidebarItems/sidebarItems'
import { getSidebarItemAncestors } from './folders'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import type { Folder, FolderFromDb, FolderWithContent } from './types'

export const enhanceFolder = async (
  ctx: QueryCtx,
  folder: FolderFromDb,
): Promise<Folder> => {
  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: folder.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const [bookmark, shares, myPermissionLevel] = await Promise.all([
    getBookmark(
      ctx,
      folder.campaignId,
      campaignWithMembership.member._id,
      folder._id,
    ),
    getSidebarItemSharesForItem(ctx, folder.campaignId, folder._id),
    getSidebarItemPermissionLevel(ctx, folder),
  ])

  return {
    ...folder,
    isBookmarked: !!bookmark,
    shares,
    myPermissionLevel,
  }
}

export const enhanceFolderWithContent = async (
  ctx: QueryCtx,
  folder: Folder,
  viewAsPlayerId?: Id<'campaignMembers'>,
): Promise<FolderWithContent> => {
  const [ancestors, children] = await Promise.all([
    getSidebarItemAncestors(ctx, folder.campaignId, folder.parentId),
    getSidebarItemsByParent(ctx, folder.campaignId, folder._id, viewAsPlayerId),
  ])
  return {
    ...folder,
    ancestors,
    children,
  }
}
