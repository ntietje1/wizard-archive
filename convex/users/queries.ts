import { v } from 'convex/values'
import { query } from '../_generated/server'
import { userProfileValidator } from './schema'
import { getUserProfileByUserId } from './functions/getUserProfile'
import type { UserProfile } from './types'

export const getUserProfile = query({
  args: {},
  returns: v.union(v.null(), userProfileValidator),
  handler: async (ctx): Promise<UserProfile | null> => {
    const userIdentity = await ctx.auth.getUserIdentity()
    if (!userIdentity) return null
    return await getUserProfileByUserId(ctx, { userId: userIdentity.subject })
  },
})
