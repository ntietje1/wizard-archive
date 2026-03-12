import { v } from 'convex/values'
import { query } from '../_generated/server'
import { userProfileValidator } from './schema'
import { getUserProfileByUserId } from './functions/getUserProfile'
import type { UserProfile } from './types'

export const isEmailVerified = query({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique()
    return profile?.emailVerified ?? false
  },
})

export const getUserProfile = query({
  args: {},
  returns: v.union(v.null(), userProfileValidator),
  handler: async (ctx): Promise<UserProfile | null> => {
    const userIdentity = await ctx.auth.getUserIdentity()
    if (!userIdentity) return null
    return await getUserProfileByUserId(ctx, { userId: userIdentity.subject })
  },
})
