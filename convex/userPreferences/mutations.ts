import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { authMutation } from '../functions'
import type { Doc, Id } from '../_generated/dataModel'
import type { AuthMutationCtx } from '../functions'

async function getUserPreferencesForCurrentUser(ctx: AuthMutationCtx): Promise<{
  userId: Id<'userProfiles'>
  existing: Doc<'userPreferences'> | null
}> {
  const userId = ctx.user.profile._id
  const existing = await ctx.db
    .query('userPreferences')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()

  return { userId, existing }
}

async function upsertUserPreferences(
  ctx: AuthMutationCtx,
  {
    existing,
    theme,
    userId,
  }: {
    existing: Doc<'userPreferences'> | null
    theme: Doc<'userPreferences'>['theme']
    userId: Id<'userProfiles'>
  },
): Promise<Id<'userPreferences'>> {
  if (!existing) {
    return await ctx.db.insert('userPreferences', {
      userId,
      theme,
    })
  }

  await ctx.db.patch('userPreferences', existing._id, { theme })
  return existing._id
}

export const setUserPreferences = authMutation({
  args: {
    theme: v.optional(literals('light', 'dark', 'system')),
  },
  returns: v.id('userPreferences'),
  handler: async (ctx, args) => {
    const { existing, userId } = await getUserPreferencesForCurrentUser(ctx)
    return await upsertUserPreferences(ctx, { existing, theme: args.theme ?? null, userId })
  },
})
