import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { Bookmark } from '../types'

export async function toggleItemBookmark(
  ctx: CampaignMutationCtx,
  { sidebarItemId }: { sidebarItemId: Id<'sidebarItems'> },
): Promise<{
  after: Bookmark | null
  before: Bookmark | null
  isBookmarked: boolean
}> {
  const item = await getSidebarItem(ctx, sidebarItemId)
  if (!item) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'This item could not be found')
  }

  const campaignId = item.campaignId
  const campaignMemberId = ctx.membership._id

  await requireItemAccess(ctx, {
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

  if (existingBookmark) {
    await ctx.db.delete('bookmarks', existingBookmark._id)
    return {
      after: null,
      before: existingBookmark,
      isBookmarked: false,
    }
  }

  const bookmarkId = await ctx.db.insert('bookmarks', {
    campaignId,
    sidebarItemId,
    campaignMemberId,
  })
  const bookmark = (await ctx.db.get('bookmarks', bookmarkId))!
  return {
    after: bookmark,
    before: null,
    isBookmarked: true,
  }
}
