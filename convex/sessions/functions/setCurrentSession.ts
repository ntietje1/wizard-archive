import { requireDmRole } from '../../functions'
import { ERROR_CODE, throwClientError } from '../../errors'
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
    throwClientError(ERROR_CODE.NOT_FOUND, 'Session not found')
  }

  const campaignId = session.campaignId
  await requireDmRole(ctx, campaignId)

  const currentSession = await getCurrentSession(ctx, { campaignId })
  if (currentSession) {
    throwClientError(ERROR_CODE.CONFLICT, 'Cannot resume a session while another session is active')
  }

  const now = Date.now()

  await Promise.all([
    ctx.db.patch('sessions', sessionId, {
      endedAt: null,
      updatedTime: now,
      updatedBy: ctx.user.profile._id,
    }),
    ctx.db.patch('campaigns', campaignId, {
      currentSessionId: sessionId,
      updatedTime: now,
      updatedBy: ctx.user.profile._id,
    }),
  ])
  return sessionId
}
