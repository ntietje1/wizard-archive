import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { toggleItemBookmark } from './functions/toggleItemBookmark'

export const toggleBookmark = campaignMutation({
  args: {
    sidebarItemId: v.id('sidebarItems'),
  },
  returns: v.object({ isBookmarked: v.boolean() }),
  handler: async (ctx, args): Promise<{ isBookmarked: boolean }> => {
    return await toggleItemBookmark(ctx, { sidebarItemId: args.sidebarItemId })
  },
})
