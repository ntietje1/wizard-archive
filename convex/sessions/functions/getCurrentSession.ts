import { requireCampaignMembership } from '../../functions'
import { getSession } from './getSession'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { Session } from '../types'

export async function getCurrentSession(
  ctx: AuthQueryCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<Session | null> {
  const { campaign } = await requireCampaignMembership(ctx, campaignId)
  const currentSessionId = campaign.currentSessionId
  if (!currentSessionId) return null
  return getSession(ctx, { sessionId: currentSessionId })
}
