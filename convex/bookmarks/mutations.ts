import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'
import { toggleItemBookmark } from './functions/toggleItemBookmark'

export const toggleBookmark = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
  },
  returns: v.object({ isBookmarked: v.boolean() }),
  handler: async (ctx, args): Promise<{ isBookmarked: boolean }> => {
    return await toggleItemBookmark(ctx, { sidebarItemId: args.sidebarItemId })
  },
})
