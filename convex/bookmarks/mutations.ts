import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import {
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'

export const toggleBookmark = mutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    sidebarItemType: sidebarItemTypeValidator,
  },
  returns: v.object({ isBookmarked: v.boolean() }),
  handler: async (ctx, args): Promise<{ isBookmarked: boolean }> => {
    const { campaignWithMembership } = await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    const campaignMemberId = campaignWithMembership.member._id

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
