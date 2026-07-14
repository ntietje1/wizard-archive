import { toSession } from './getSession'
import type { CampaignQueryCtx } from '../../functions'
import type { Session } from '../../../shared/sessions/types'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'

export async function getSessionsByCampaign(ctx: CampaignQueryCtx): Promise<Array<Session>> {
  const campaignId = ctx.campaign._id

  const sessions = await ctx.db
    .query('sessions')
    .withIndex('by_campaign_startedAt', (q) => q.eq('campaignId', campaignId))
    .order('desc')
    .collect()

  const campaignDomainId = assertDomainId(DOMAIN_ID_KIND.campaign, ctx.campaign.campaignUuid)
  return sessions.map((session) => toSession(session, campaignDomainId))
}
