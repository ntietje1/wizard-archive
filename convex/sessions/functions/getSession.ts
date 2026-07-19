import type { Doc } from '../../_generated/dataModel'
import type { Session } from '../../../shared/sessions/types'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { CampaignId, SessionId } from '@wizard-archive/editor/resources/domain-id'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignQueryCtx } from '../../functions'

export function toSession(session: Doc<'sessions'>, campaignId: CampaignId): Session {
  const { _id: _rowId, _creationTime, sessionUuid, campaignId: _campaignRowId, ...fields } = session
  return {
    ...fields,
    id: assertDomainId(DOMAIN_ID_KIND.session, sessionUuid),
    createdAt: _creationTime,
    campaignId,
  }
}

export async function getCampaignSessionRow(
  ctx: CampaignQueryCtx,
  { sessionId }: { sessionId: SessionId },
): Promise<Doc<'sessions'>> {
  const session = await ctx.db
    .query('sessions')
    .withIndex('by_sessionUuid', (query) => query.eq('sessionUuid', sessionId))
    .unique()
  if (!session) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Session not found')
  }
  if (session.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Session does not belong to this campaign')
  }
  return session
}
