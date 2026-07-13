import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { getCurrentSession } from './getCurrentSession'
import { getCampaignSessionRow } from './getSession'
import type { SessionId } from '@wizard-archive/editor/resources/domain-id'
import type { DmMutationCtx } from '../../functions'

export async function setCurrentSession(
  ctx: DmMutationCtx,
  { sessionId }: { sessionId: SessionId },
): Promise<SessionId> {
  const sessionRow = await getCampaignSessionRow(ctx, { sessionId })

  const currentSession = await getCurrentSession(ctx)
  if (currentSession) {
    throwClientError(ERROR_CODE.CONFLICT, 'Cannot resume a session while another session is active')
  }

  await Promise.all([
    ctx.db.patch('sessions', sessionRow._id, {
      endedAt: null,
    }),
    ctx.db.patch('campaigns', ctx.campaign._id, {
      currentSessionId: sessionRow._id,
    }),
  ])
  return sessionId
}
