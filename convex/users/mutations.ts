import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { ensureUserProfile as ensureUserProfileFn } from './functions/ensureUserProfile'
import type { Id } from '../_generated/dataModel'

export const ensureUserProfile = mutation({
  args: {},
  returns: v.id('userProfiles'),
  handler: async (ctx): Promise<Id<'userProfiles'>> => {
    return ensureUserProfileFn(ctx)
  },
})
