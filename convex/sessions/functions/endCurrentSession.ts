import { ERROR_CODE, throwClientError } from '../../errors'
import { getCurrentSession } from './getCurrentSession'
import type { Id } from '../../_generated/dataModel'
import type { DmMutationCtx } from '../../functions'

export async function endCurrentSession(ctx: DmMutationCtx): Promise<Id<'sessions'>> {
  const campaignId = ctx.campaign._id

  const currentSession = await getCurrentSession(ctx)
  if (!currentSession) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'No active session')
  }

  const now = Date.now()

  await Promise.all([
    ctx.db.patch('sessions', currentSession._id, {
      endedAt: now,
    }),
    ctx.db.patch('campaigns', campaignId, {
      currentSessionId: null,
    }),
  ])
  return currentSession._id
}
