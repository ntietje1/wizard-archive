import { v } from 'convex/values'
import { query } from '../_generated/server'
import { userPreferencesValidator } from './schema'
import type { UserPreferences } from './types'

export const getUserPreferences = query({
  args: {},
  returns: v.union(v.null(), userPreferencesValidator),
  handler: async (ctx): Promise<UserPreferences | null> => {
    const userIdentity = await ctx.auth.getUserIdentity()
    if (!userIdentity) return null

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('authUserId', userIdentity.subject))
      .unique()
    if (!profile) return null

    return await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', profile._id))
      .unique()
  },
})
