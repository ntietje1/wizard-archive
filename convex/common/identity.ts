import { UserIdentity } from 'convex/server'
import { Ctx } from './types'
import { UserProfile } from '../users/types'

export type UserIdentityWithProfile = {
  identity: UserIdentity
  profile: UserProfile
}

export async function getUserIdentity(
  ctx: Ctx,
): Promise<UserIdentityWithProfile | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  let profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('clerkUserId', identity.subject))
    .unique()

  if (!profile) {
    return null
  }

  return { identity, profile }
}

export async function requireUserIdentity(
  ctx: Ctx,
): Promise<UserIdentityWithProfile> {
  const result = await getUserIdentity(ctx)
  if (!result) throw new Error('Not authenticated')

  return result
}
