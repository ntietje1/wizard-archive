import type { QueryCtx } from '../../_generated/server'
import type { UserProfile } from '../types'

async function resolveProfileImageUrl(
  ctx: QueryCtx,
  profile: UserProfile,
): Promise<UserProfile> {
  if (!profile.imageStorageId) return profile
  const url = await ctx.storage.getUrl(profile.imageStorageId)
  return { ...profile, imageUrl: url ?? undefined }
}

export async function getUserProfileByUserId(
  ctx: QueryCtx,
  { userId }: { userId: string },
): Promise<UserProfile | null> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('authUserId', userId))
    .unique()
  if (!profile) return null
  return resolveProfileImageUrl(ctx, profile)
}

export async function getUserProfileByUsername(
  ctx: QueryCtx,
  { username }: { username: string },
): Promise<UserProfile | null> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_username', (q) => q.eq('username', username))
    .unique()
  if (!profile) return null
  return resolveProfileImageUrl(ctx, profile)
}
