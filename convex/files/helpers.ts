import { getSidebarItemAncestors } from '../folders/folders'
import {
  getSidebarItemPermissionLevel,
  getSidebarItemSharesForItem,
} from '../shares/itemShares'
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

  const [downloadUrl, bookmark, shares, storageMetadata, myPermissionLevel] =
    await Promise.all([
      file.storageId ? ctx.storage.getUrl(file.storageId) : null,
      getBookmark(
        ctx,
        file.campaignId,
        campaignWithMembership.member._id,
        file._id,
      ),
      getSidebarItemSharesForItem(ctx, file.campaignId, file._id),
      file.storageId ? ctx.db.system.get(file.storageId) : null,
      getSidebarItemPermissionLevel(ctx, file),
    ])

  return {
    ...file,
    downloadUrl,
    isBookmarked: !!bookmark,
    shares,
    contentType: storageMetadata?.contentType ?? null,
    myPermissionLevel,
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
