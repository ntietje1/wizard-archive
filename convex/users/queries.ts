import { v } from 'convex/values'
import { query } from '../_generated/server'
import { authQuery } from '../functions'
import { getAuthProfileKey } from '../auth/identity'
import { assertUsername, usernameValidator } from './validation'
import { userProfileValidator } from './schema'
import { getUserProfileByAuthProfileKey } from './functions/getUserProfile'
import { checkUsernameExists as checkUsernameExistsFn } from './functions/checkUsernameExists'
import type { UserProfile } from '../../shared/users/types'

export const getUserProfile = query({
  args: {},
  returns: v.union(v.null(), userProfileValidator),
  handler: async (ctx): Promise<UserProfile | null> => {
    const userIdentity = await ctx.auth.getUserIdentity()
    if (!userIdentity) return null
    return await getUserProfileByAuthProfileKey(ctx, {
      authProfileKey: getAuthProfileKey(userIdentity),
    })
  },
})

export const checkUsernameExists = authQuery({
  args: {
    username: usernameValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await checkUsernameExistsFn(ctx, { username: assertUsername(args.username) })
  },
})
