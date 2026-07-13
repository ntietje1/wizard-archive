import { getSessionByRowId } from './getSession'
import type { CampaignQueryCtx } from '../../functions'
import type { Session } from '../../../shared/sessions/types'

export async function getCurrentSession(ctx: CampaignQueryCtx): Promise<Session | null> {
  const currentSessionId = ctx.campaign.currentSessionId
  if (!currentSessionId) return null
  return getSessionByRowId(ctx, { sessionId: currentSessionId })
}
