import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { purgeExpiredAuthData as purgeExpiredAuthDataFn } from './functions/purgeExpiredAuthData'

export const purgeExpiredAuthData = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<void> => {
    return purgeExpiredAuthDataFn(ctx)
  },
})
