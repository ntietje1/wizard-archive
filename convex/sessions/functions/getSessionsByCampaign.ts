import type { CampaignQueryCtx } from '../../functions'
import type { Session } from '../types'

export async function getSessionsByCampaign(ctx: CampaignQueryCtx): Promise<Array<Session>> {
  const campaignId = ctx.campaign._id

  const sessions = await ctx.db
    .query('sessions')
    .withIndex('by_campaign_startedAt', (q) => q.eq('campaignId', campaignId))
    .order('desc')
    .collect()

  return sessions.filter((s) => s.deletionTime === null)
}
