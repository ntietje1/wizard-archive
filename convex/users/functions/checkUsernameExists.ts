import type { Username } from '../validation'
import type { AuthQueryCtx } from '../../functions'

export async function checkUsernameExists(
  ctx: AuthQueryCtx,
  args: { username: Username },
): Promise<boolean> {
  const existing = await ctx.db
    .query('userProfiles')
    .withIndex('by_username', (q) => q.eq('username', args.username))
    .unique()

  if (!existing) return false
  if (existing._id === ctx.user.profile._id) return false
  return true
}
