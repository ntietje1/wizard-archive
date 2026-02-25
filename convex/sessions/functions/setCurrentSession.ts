import { getCurrentSession } from './getCurrentSession'
import { getSession } from './getSession'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

export async function setCurrentSession(
  ctx: CampaignMutationCtx,
  { sessionId }: { sessionId: Id<'sessions'> },
): Promise<Id<'sessions'>> {
  const campaignId = ctx.campaign._id
  const now = Date.now()

  const newSession = await getSession(ctx, { sessionId })
  if (!newSession || newSession.campaignId !== campaignId) {
    throw new Error('Session not found')
  }

  const currentSession = await getCurrentSession(ctx)
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
