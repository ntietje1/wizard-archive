import type { QueryCtx } from '../../_generated/server'
import type { UserProfile } from '../types'

export async function getUserProfileByUserId(
  ctx: QueryCtx,
  { userId }: { userId: string },
): Promise<UserProfile | null> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('clerkUserId', userId))
    .unique()
  return profile
}

export async function getUserProfileByUsername(
  ctx: QueryCtx,
  { username }: { username: string },
): Promise<UserProfile | null> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_username', (q) => q.eq('username', username))
    .unique()
  return profile
}
