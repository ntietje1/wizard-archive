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
        ...args,
        updatedTime: now,
        updatedBy: userId,
        createdBy: userId,
      })
    }

    await ctx.db.patch(existing._id, {
      ...(args.sidebarWidth !== undefined && {
        sidebarWidth: args.sidebarWidth,
      }),
      ...(args.isSidebarExpanded !== undefined && {
        isSidebarExpanded: args.isSidebarExpanded,
      }),
      ...(args.theme !== undefined && { theme: args.theme }),
      updatedTime: now,
      updatedBy: userId,
    })

    return existing._id
  },
})
