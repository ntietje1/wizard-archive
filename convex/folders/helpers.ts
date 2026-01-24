import { getSidebarItemSharesForItem } from '../shares/shares'
import { getBookmark } from '../bookmarks/bookmarks'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getSidebarItemAncestors } from './folders'
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

  const [bookmark, shares] = await Promise.all([
    getBookmark(
      ctx,
      folder.campaignId,
      campaignWithMembership.member._id,
      folder._id,
    ),
    getSidebarItemSharesForItem(ctx, folder.campaignId, folder._id),
  ])

  return {
    ...folder,
    isBookmarked: !!bookmark,
    shares,
  }
}

export const enhanceFolderWithContent = async (
  ctx: QueryCtx,
  folder: Folder,
): Promise<FolderWithContent> => {
  const ancestors = await getSidebarItemAncestors(
    ctx,
    folder.campaignId,
    folder.parentId,
  )
  return {
    ...folder,
    ancestors,
  }
}
