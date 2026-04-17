import { findUniqueSlug } from '../../common/slug'
import { parseUsername } from '../../users/validation'
import { USERNAME_MAX_LENGTH } from '../../users/constants'
import type { MutationCtx } from '../../_generated/server'

type AuthUserDoc = {
  _id: string
  _creationTime: number
  email: string
  name: string
  image?: string | null
  emailVerified: boolean
  twoFactorEnabled?: boolean | null
}

export async function onCreateUser(ctx: MutationCtx, user: AuthUserDoc): Promise<void> {
  const baseUsername =
    (user.email ? user.email.split('@')[0] : undefined) ||
    user.name?.toLowerCase().replace(/\s+/g, '') ||
    `user${String(user._id).slice(-8)}`

  const username = await findUniqueSlug(
    baseUsername,
    async (slug) => {
      const conflict = await ctx.db
        .query('userProfiles')
        .withIndex('by_username', (q) => q.eq('username', slug))
        .unique()
      return conflict !== null
    },
    {
      maxLength: USERNAME_MAX_LENGTH,
      isValidCandidate: (slug) => parseUsername(slug) !== null,
    },
  )

  await ctx.db.insert('userProfiles', {
    authUserId: String(user._id),
    username,
    email: user.email ?? null,
    emailVerified: user.emailVerified ?? null,
    name: user.name ?? null,
    profileImage: user.image ? { type: 'external' as const, url: user.image } : null,
    twoFactorEnabled: user.twoFactorEnabled ?? null,
  })
}
