import { requireCampaignMembership } from '../../functions'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { Session } from '../types'

export async function getSessionsByCampaign(
  ctx: AuthQueryCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<Array<Session>> {
  await requireCampaignMembership(ctx, campaignId)

  const sessions = await ctx.db
    .query('sessions')
    .withIndex('by_campaign_startedAt', (q) => q.eq('campaignId', campaignId))
    .order('desc')
    .collect()

  return sessions.filter((s) => s.deletionTime === null)
}
