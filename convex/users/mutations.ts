import { v } from 'convex/values'
import { authMutation } from '../functions'

export const setTheme = authMutation({
  args: {
    theme: v.union(v.literal('light'), v.literal('dark'), v.literal('system')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.user.profile._id, { theme: args.theme })
    return null
  },
})
