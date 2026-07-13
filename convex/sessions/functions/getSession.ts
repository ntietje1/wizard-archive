import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { Session } from '../../../shared/sessions/types'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { SessionId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignQueryCtx } from '../../functions'

export function toSession(session: Doc<'sessions'>): Session {
  const { _id: _rowId, _creationTime, sessionUuid, ...fields } = session
  return {
    ...fields,
    id: sessionUuid,
    createdAt: _creationTime,
  }
}

export async function getSessionByRowId(
  ctx: QueryCtx,
  { sessionId }: { sessionId: Id<'sessions'> },
): Promise<Session | null> {
  const session = await ctx.db.get('sessions', sessionId)
  return session ? toSession(session) : null
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
