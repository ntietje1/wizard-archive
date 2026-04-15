import { ERROR_CODE, throwClientError } from '../../errors'
import { getCurrentSession } from './getCurrentSession'
import { getSession } from './getSession'
import type { Id } from '../../_generated/dataModel'
import type { DmMutationCtx } from '../../functions'

export async function setCurrentSession(
  ctx: DmMutationCtx,
  { sessionId }: { sessionId: Id<'sessions'> },
): Promise<Id<'sessions'>> {
  const session = await getSession(ctx, { sessionId })
  if (!session) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Session not found')
  }

  if (session.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Session does not belong to this campaign')
  }

  const currentSession = await getCurrentSession(ctx)
  if (currentSession) {
    throwClientError(ERROR_CODE.CONFLICT, 'Cannot resume a session while another session is active')
  }

  await Promise.all([
    ctx.db.patch('sessions', sessionId, {
      endedAt: null,
    }),
    ctx.db.patch('campaigns', ctx.campaign._id, {
      currentSessionId: sessionId,
    }),
  ])
  return sessionId
}
