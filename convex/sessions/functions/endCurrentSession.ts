import { getCurrentSession } from './getCurrentSession'
import { requireDmRole } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function endCurrentSession(
  ctx: AuthMutationCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<Id<'sessions'>> {
  await requireDmRole(ctx, campaignId)

  const currentSession = await getCurrentSession(ctx, { campaignId })
  if (!currentSession) {
    throw new Error('No active session')
  }

  const now = Date.now()

  await ctx.db.patch(currentSession._id, {
    endedAt: now,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })
  await ctx.db.patch(campaignId, {
    currentSessionId: null,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })
  return currentSession._id
}
