import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { authMutation } from '../functions'
import { ensureUserProfile as ensureUserProfileFn } from './functions/ensureUserProfile'
import type { Id } from '../_generated/dataModel'

export const ensureUserProfile = mutation({
  args: {},
  returns: v.id('userProfiles'),
  handler: async (ctx): Promise<Id<'userProfiles'>> => {
    return ensureUserProfileFn(ctx)
  },
})

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
