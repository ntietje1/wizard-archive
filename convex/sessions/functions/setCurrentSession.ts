import { requireDmRole } from '../../functions'
import { getCurrentSession } from './getCurrentSession'
import { getSession } from './getSession'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function setCurrentSession(
  ctx: AuthMutationCtx,
  { sessionId }: { sessionId: Id<'sessions'> },
): Promise<Id<'sessions'>> {
  const session = await getSession(ctx, { sessionId })
  if (!session) {
    throw new Error('Session not found')
  }

  const campaignId = session.campaignId
  await requireDmRole(ctx, campaignId)
  const now = Date.now()

  const currentSession = await getCurrentSession(ctx, { campaignId })
  if (currentSession && currentSession._id !== sessionId) {
    await ctx.db.patch(currentSession._id, {
      endedAt: now,
      updatedTime: now,
      updatedBy: ctx.user.profile._id,
    })
  }

  // Remove endedAt to mark session as active (undefined removes the optional field)
  await ctx.db.patch(sessionId, {
    endedAt: undefined,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })

  await ctx.db.patch(campaignId, {
    currentSessionId: sessionId,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })
  return sessionId
}
