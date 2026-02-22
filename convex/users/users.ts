import type { QueryCtx } from '../_generated/server'

export async function getUserProfileByUserIdHandler(
  ctx: QueryCtx,
  userId: string,
) {
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
