import { requireDmRole } from '../../functions'
import { ERROR_CODE, throwAppError } from '../../errors'
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

  const currentSession = await getCurrentSession(ctx, { campaignId })
  if (currentSession) {
    throwAppError(
      ERROR_CODE.CONFLICT_SESSION_ACTIVE,
      'Cannot resume a session while another session is active',
    )
  }

  const now = Date.now()

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
