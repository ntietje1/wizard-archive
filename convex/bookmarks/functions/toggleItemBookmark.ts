import { ERROR_CODE, throwClientError } from '../../errors'
import { checkItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import type { AuthMutationCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export async function toggleItemBookmark(
  ctx: AuthMutationCtx,
  { sidebarItemId }: { sidebarItemId: SidebarItemId },
) {
  // eslint-disable-next-line @convex-dev/explicit-table-ids -- SidebarItemId is a union across multiple tables
  const item = await ctx.db.get(sidebarItemId)
  if (!item) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'This item could not be found')
  }

  const campaignId = item.campaignId
  const { membership } = await requireCampaignMembership(ctx, campaignId)

  await checkItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  const campaignMemberId = membership._id

  // Check if bookmark already exists
  const existingBookmark = await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_member_item', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('campaignMemberId', campaignMemberId)
        .eq('sidebarItemId', sidebarItemId),
    )
    .unique()

  const now = Date.now()
  const profileId = ctx.user.profile._id

  if (existingBookmark) {
    if (existingBookmark.deletionTime === null) {
      await ctx.db.patch("bookmarks", existingBookmark._id, {
        deletionTime: now,
        deletedBy: profileId,
        updatedTime: now,
        updatedBy: profileId,
      })
      return { isBookmarked: false }
    }
    await ctx.db.patch("bookmarks", existingBookmark._id, {
      deletionTime: null,
      deletedBy: null,
      updatedTime: now,
      updatedBy: profileId,
    })
    return { isBookmarked: true }
  }

  await ctx.db.insert('bookmarks', {
    campaignId,
    sidebarItemId,
    campaignMemberId,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profileId,
  })
  return { isBookmarked: true }
}
