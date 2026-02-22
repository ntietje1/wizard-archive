import type { AuthUser, UserProfile } from './types'
import type { QueryCtx } from '../_generated/server'

export async function getUserProfileByUserIdHandler(
  ctx: QueryCtx,
  userId: string,
): Promise<UserProfile | null> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('clerkUserId', userId))
    .unique()
  return profile
}

export async function getUserProfileByUsernameHandler(
  ctx: QueryCtx,
  username: string,
) {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_username', (q) => q.eq('username', username))
    .unique()
  return profile
}

export async function getUserIdentity(ctx: QueryCtx): Promise<AuthUser | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  const profile = await getUserProfileByUserIdHandler(ctx, identity.subject)

  if (!profile) {
    return null
  }

  return { identity, profile }
}
