import { v } from 'convex/values'
import { query } from '../_generated/server'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import {
  getCurrentSession as getCurrentSessionHandler,
  getSessionsByCampaign as getSessionsByCampaignHandler,
} from './sessions'
import { sessionValidator } from './schema'
import type { Session } from './types'

export const getCurrentSession = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.union(v.null(), sessionValidator),
  handler: async (ctx, args): Promise<Session | null> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )
    return await getCurrentSessionHandler(ctx, args.campaignId)
  },
})

export const getSessionsByCampaign = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(sessionValidator),
  handler: async (ctx, args): Promise<Array<Session>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )
    return await getSessionsByCampaignHandler(ctx, args.campaignId)
  },
})
