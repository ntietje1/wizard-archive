import { asyncMap } from 'convex-helpers'
import type { PaginationOptions, PaginationResult } from 'convex/server'
import { CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { getCampaign } from './getCampaign'
import type { Campaign } from '../../../shared/campaigns/types'
import type { AuthQueryCtx } from '../../functions'

const MAX_CAMPAIGNS_PER_PAGE = 50

export async function getUserCampaigns(
  ctx: AuthQueryCtx,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<Campaign>> {
  const profile = ctx.user.profile
  const boundedPagination = {
    ...paginationOpts,
    numItems: Math.min(MAX_CAMPAIGNS_PER_PAGE, Math.max(1, Math.floor(paginationOpts.numItems))),
  }

  const memberships = await ctx.db
    .query('campaignMembers')
    .withIndex('by_user_status', (q) =>
      q.eq('userId', profile._id).eq('status', CAMPAIGN_MEMBER_STATUS.Accepted),
    )
    .order('desc')
    .paginate(boundedPagination)

  const results = await asyncMap(memberships.page, (membership) =>
    getCampaign(ctx, { campaignId: membership.campaignId }),
  )

  return { ...memberships, page: results.filter((campaign) => campaign !== null) }
}
