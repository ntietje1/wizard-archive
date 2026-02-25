import { getCurrentSession } from './getCurrentSession'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

export async function endCurrentSession(
  ctx: CampaignMutationCtx,
): Promise<Id<'sessions'>> {
  const currentSession = await getCurrentSession(ctx)
  if (!currentSession) {
    throw new Error('No active session')
  }

  const now = Date.now()

  await ctx.db.patch(currentSession._id, {
    endedAt: now,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })
  await ctx.db.patch(ctx.campaign._id, {
    currentSessionId: null,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })
  return currentSession._id
}
