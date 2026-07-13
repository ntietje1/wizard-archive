import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { getCurrentSession } from './getCurrentSession'
import type { SessionId } from '@wizard-archive/editor/resources/domain-id'
import type { DmMutationCtx } from '../../functions'

export async function endCurrentSession(ctx: DmMutationCtx): Promise<SessionId> {
  const campaignId = ctx.campaign._id

  const currentSession = await getCurrentSession(ctx)
  if (!currentSession) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'No active session')
  }

  const now = Date.now()

  await Promise.all([
    ctx.db.patch('sessions', ctx.campaign.currentSessionId!, {
      endedAt: now,
    }),
    ctx.db.patch('campaigns', campaignId, {
      currentSessionId: null,
    }),
  ])
  return currentSession.id
}
