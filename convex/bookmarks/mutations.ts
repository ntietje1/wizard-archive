import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import {
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'
import { PERMISSION_LEVEL } from '../shares/types'
import { checkItemAccess } from '../sidebarItems/validation'

export const toggleBookmark = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    sidebarItemType: sidebarItemTypeValidator,
  },
  returns: v.object({ isBookmarked: v.boolean() }),
  handler: async (ctx, args): Promise<{ isBookmarked: boolean }> => {
    const campaignId = ctx.campaign._id
    const campaignMemberId = ctx.membership._id

    const item = await ctx.db.get(args.sidebarItemId)
    await checkItemAccess(ctx, item, PERMISSION_LEVEL.VIEW)

    // Check if bookmark already exists
    const existingBookmark = await ctx.db
      .query('bookmarks')
      .withIndex('by_campaign_member_item', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('campaignMemberId', campaignMemberId)
          .eq('sidebarItemId', args.sidebarItemId),
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
        sidebarItemId: args.sidebarItemId,
        sidebarItemType: args.sidebarItemType,
        campaignMemberId,
      })
      return { isBookmarked: true }
    }
  },
})
