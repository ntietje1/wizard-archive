import { v } from 'convex/values'
import { authMutation } from '../functions'

export const setUserPreferences = authMutation({
  args: {
    sidebarWidth: v.optional(v.number()),
    isSidebarExpanded: v.optional(v.boolean()),
    theme: v.optional(
      v.union(v.literal('light'), v.literal('dark'), v.literal('system')),
    ),
  },
  returns: v.id('userPreferences'),
  handler: async (ctx, args) => {
    const now = Date.now()
    const userId = ctx.user.profile._id

    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()

    if (!existing) {
      return await ctx.db.insert('userPreferences', {
        userId,
        sidebarWidth: args.sidebarWidth ?? null,
        isSidebarExpanded: args.isSidebarExpanded ?? null,
        theme: args.theme ?? null,
        deletionTime: null,
        deletedBy: null,
        updatedTime: null,
        updatedBy: null,
        createdBy: userId,
      })
    } else {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedTime: now,
        updatedBy: userId,
      })

      return existing._id
    }
  },
})
