import type { MutationCtx } from '../../_generated/server'
import type { ProfileImage } from '../../users/types'

type AuthUserDoc = {
  _id: string
  _creationTime: number
  email: string
  name: string
  image?: string | null
  emailVerified: boolean
  twoFactorEnabled?: boolean | null
}

export async function onUpdateUser(
  ctx: MutationCtx,
  newUser: AuthUserDoc,
  oldUser: AuthUserDoc,
): Promise<void> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('authUserId', newUser._id))
    .unique()
  if (!profile) return

  const updates: Partial<{
    name: string | null
    email: string | null
    emailVerified: boolean | null
    profileImage: ProfileImage | null
    twoFactorEnabled: boolean | null
  }> = {}
  if (newUser.name !== oldUser.name) updates.name = newUser.name
  if (newUser.email !== oldUser.email) updates.email = newUser.email
  if (newUser.emailVerified !== oldUser.emailVerified) updates.emailVerified = newUser.emailVerified
  // Only update profile image from OAuth if user hasn't uploaded their own
  if (newUser.image !== oldUser.image) {
    const hasUserUpload = profile.profileImage?.type === 'storage'
    if (!hasUserUpload) {
      updates.profileImage = newUser.image ? { type: 'external', url: newUser.image } : null
    }
  }
  if (newUser.twoFactorEnabled !== oldUser.twoFactorEnabled)
    updates.twoFactorEnabled = newUser.twoFactorEnabled ?? null

  if (Object.keys(updates).length > 0) {
    await ctx.db.patch("userProfiles", profile._id, updates)
  }
}
