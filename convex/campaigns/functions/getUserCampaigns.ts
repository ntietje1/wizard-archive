import { asyncMap } from 'convex-helpers'
import { CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { getCampaign } from './getCampaign'
import type { Campaign } from '../../../shared/campaigns/types'
import type { AuthQueryCtx } from '../../functions'

const MAX_CAMPAIGNS_PER_USER = 100

export async function getUserCampaigns(ctx: AuthQueryCtx): Promise<Array<Campaign>> {
  const profile = ctx.user.profile

  const campaignMemberships = await ctx.db
    .query('campaignMembers')
    .withIndex('by_user_status', (q) =>
      q.eq('userId', profile._id).eq('status', CAMPAIGN_MEMBER_STATUS.Accepted),
    )
    .take(MAX_CAMPAIGNS_PER_USER)

  const results = await asyncMap(campaignMemberships, (membership) =>
    getCampaign(ctx, { campaignId: membership.campaignId }),
  )

  return results.filter((r) => r !== null)
}
