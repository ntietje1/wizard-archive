import { ERROR_CODE, throwClientError } from '../../errors'
import { checkItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function toggleItemBookmark(
  ctx: CampaignMutationCtx,
  { sidebarItemId }: { sidebarItemId: Id<'sidebarItems'> },
) {
  const item = await getSidebarItem(ctx, sidebarItemId)
  if (!item) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'This item could not be found')
  }

  const campaignId = item.campaignId
  const campaignMemberId = ctx.membership._id

  await checkItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

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
  const userId = ctx.membership.userId

  if (existingBookmark) {
    if (existingBookmark.deletionTime === null) {
      await ctx.db.patch('bookmarks', existingBookmark._id, {
        deletionTime: now,
        deletedBy: userId,
        updatedTime: now,
        updatedBy: userId,
      })
      return { isBookmarked: false }
    }
    await ctx.db.patch('bookmarks', existingBookmark._id, {
      deletionTime: null,
      deletedBy: null,
      updatedTime: now,
      updatedBy: userId,
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
    createdBy: userId,
  })
  return { isBookmarked: true }
}
