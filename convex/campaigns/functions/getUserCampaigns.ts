import { CAMPAIGN_MEMBER_STATUS } from '../types'
import { getCampaign } from './getCampaign'
import type { Campaign } from '../types'
import type { AuthQueryCtx } from '../../functions'

export async function getUserCampaigns(
  ctx: AuthQueryCtx,
): Promise<Array<Campaign>> {
  const profile = ctx.user.profile

  const campaignMemberships = await ctx.db
    .query('campaignMembers')
    .withIndex('by_user', (q) => q.eq('userId', profile._id))
    .collect()
    .then((memberships) =>
      memberships.filter(
        (membership) => membership.status === CAMPAIGN_MEMBER_STATUS.Accepted,
      ),
    )

  const results = await Promise.all(
    campaignMemberships.map(async (membership) => {
      return await getCampaign(ctx, { campaignId: membership.campaignId })
    }),
  )

  return results.filter((r) => r !== null)
}
