import { internal } from '../../_generated/api'
import type { MutationCtx } from '../../_generated/server'

type AuthUserDoc = {
  _id: string
  _creationTime: number
}

export async function onDeleteUser(ctx: MutationCtx, user: AuthUserDoc): Promise<void> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('authUserId', user._id))
    .unique()
  if (!profile) return

  if (profile.deletionStage) return

  await ctx.db.patch('userProfiles', profile._id, { deletionStage: 'preferences' })
  await ctx.scheduler.runAfter(0, internal.auth.internalMutations.processUserDeletion, {
    profileId: profile._id,
    stage: 'preferences',
  })
}
