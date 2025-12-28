import { mutation } from '../_generated/server'
import { upsertUserProfileHandler } from './users'
import type { Id } from '../_generated/dataModel'

export const ensureUserProfile = mutation({
  handler: async (ctx): Promise<Id<'userProfiles'>> => {
    return await upsertUserProfileHandler(ctx)
  },
})
