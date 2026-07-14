import { toSession } from './getSession'
import type { CampaignQueryCtx } from '../../functions'
import type { Session } from '../../../shared/sessions/types'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'

export async function getCurrentSession(ctx: CampaignQueryCtx): Promise<Session | null> {
  const currentSessionId = ctx.campaign.currentSessionId
  if (!currentSessionId) return null
  const session = await ctx.db.get('sessions', currentSessionId)
  if (!session || session.campaignId !== ctx.campaign._id) return null
  return toSession(session, assertDomainId(DOMAIN_ID_KIND.campaign, ctx.campaign.campaignUuid))
}
