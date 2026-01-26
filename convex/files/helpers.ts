import { getSidebarItemAncestors } from '../folders/folders'
import { getSidebarItemSharesForItem } from '../shares/shares'
import { getBookmark } from '../bookmarks/bookmarks'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import type { QueryCtx } from '../_generated/server'
import type { File, FileFromDb, FileWithContent } from './types'

export const enhanceFile = async (
  ctx: QueryCtx,
  file: FileFromDb,
): Promise<File> => {
  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: file.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const [downloadUrl, bookmark, shares, storageMetadata] = await Promise.all([
    file.storageId ? ctx.storage.getUrl(file.storageId) : null,
    getBookmark(
      ctx,
      file.campaignId,
      campaignWithMembership.member._id,
      file._id,
    ),
    getSidebarItemSharesForItem(ctx, file.campaignId, file._id),
    file.storageId ? ctx.db.system.get(file.storageId) : null,
  ])

  return {
    ...file,
    downloadUrl,
    isBookmarked: !!bookmark,
    shares,
    contentType: storageMetadata?.contentType ?? null,
  }
}

export const enhanceFileWithContent = async (
  ctx: QueryCtx,
  file: File,
): Promise<FileWithContent> => {
  const ancestors = await getSidebarItemAncestors(
    ctx,
    file.campaignId,
    file.parentId,
  )
  return {
    ...file,
    ancestors,
  }
}
