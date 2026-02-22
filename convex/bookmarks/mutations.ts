import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import {
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'

export const toggleBookmark = campaignMutation({
  args: {
    sidebarItemId: sidebarItemIdValidator,
    sidebarItemType: sidebarItemTypeValidator,
  },
  returns: v.object({ isBookmarked: v.boolean() }),
  handler: async (ctx, args): Promise<{ isBookmarked: boolean }> => {
    const campaignMemberId = ctx.membership._id

    // Check if bookmark already exists
    const existingBookmark = await ctx.db
      .query('bookmarks')
      .withIndex('by_campaign_member_item', (q) =>
        q
          .eq('campaignId', args.campaignId)
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
        campaignId: args.campaignId,
        sidebarItemId: args.sidebarItemId,
        sidebarItemType: args.sidebarItemType,
        campaignMemberId,
      })
      return { isBookmarked: true }
    }
  },
})
