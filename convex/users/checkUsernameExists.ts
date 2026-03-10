import { v } from 'convex/values'
import { authQuery } from '../functions'

export const checkUsernameExists = authQuery({
  args: {
    username: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_username', (q) => q.eq('username', args.username))
      .unique()

    if (!existing) return false
    if (existing._id === ctx.user.profile._id) return false
    return true
  },
})
