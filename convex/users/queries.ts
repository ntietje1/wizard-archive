import { v } from 'convex/values'
import { query } from '../_generated/server'
import { authQuery } from '../functions'
import { requireUsername, usernameValidator } from './validation'
import { userProfileValidator } from './schema'
import { getUserProfileByUserId } from './functions/getUserProfile'
import { checkUsernameExists as checkUsernameExistsFn } from './functions/checkUsernameExists'
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

export const checkUsernameExists = authQuery({
  args: {
    username: usernameValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await checkUsernameExistsFn(ctx, { username: requireUsername(args.username) })
  },
})
