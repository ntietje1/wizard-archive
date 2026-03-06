import { v } from 'convex/values'
import { authMutation } from '../functions'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'
import { toggleItemBookmark } from './functions/toggleItemBookmark'

export const toggleBookmark = authMutation({
  args: {
    sidebarItemId: sidebarItemIdValidator,
  },
  returns: v.object({ isBookmarked: v.boolean() }),
  handler: async (ctx, args): Promise<{ isBookmarked: boolean }> => {
    return await toggleItemBookmark(ctx, { sidebarItemId: args.sidebarItemId })
  },
})
