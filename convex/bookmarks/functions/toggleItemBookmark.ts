import { checkItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import type { AuthMutationCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export async function toggleItemBookmark(
  ctx: AuthMutationCtx,
  { sidebarItemId }: { sidebarItemId: SidebarItemId },
) {
  const item = await ctx.db.get(sidebarItemId)
  if (!item) {
    throw new Error('Sidebar item not found')
  }
  await checkItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const campaignId = item.campaignId
  const { membership } = await requireCampaignMembership(ctx, campaignId)
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

  if (existingBookmark) {
    // Remove bookmark
    await ctx.db.delete(existingBookmark._id)
    return { isBookmarked: false }
  } else {
    // Add bookmark
    await ctx.db.insert('bookmarks', {
      campaignId,
      sidebarItemId,
      campaignMemberId,
      deletionTime: null,
      deletedBy: null,
      updatedTime: null,
      updatedBy: null,
      createdBy: ctx.user.profile._id,
    })
    return { isBookmarked: true }
  }
}
