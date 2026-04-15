import { v } from 'convex/values'
import { authQuery, campaignQuery, dmQuery } from '../functions'
import { getCampaignMembers } from './functions/getCampaignMembers'
import { getCampaignRequests as getCampaignRequestsFn } from './functions/getCampaignRequests'
import { campaignMemberValidator, campaignValidator } from './schema'
import { getUserCampaigns as getUserCampaignsFn } from './functions/getUserCampaigns'
import { getCampaignBySlug as getCampaignBySlugFn } from './functions/getCampaign'

import type { Campaign, CampaignMember } from './types'

export const getUserCampaigns = authQuery({
  args: {},
  returns: v.array(campaignValidator),
  handler: async (ctx): Promise<Array<Campaign>> => {
    return getUserCampaignsFn(ctx)
  },
})

export const getCampaignBySlug = authQuery({
  args: {
    dmUsername: v.string(),
    slug: v.string(),
  },
  returns: campaignValidator,
  handler: async (ctx, args): Promise<Campaign> => {
    return await getCampaignBySlugFn(ctx, {
      dmUsername: args.dmUsername,
      slug: args.slug,
    })
  },
})

export const getPlayersByCampaign = campaignQuery({
  args: {},
  returns: v.array(campaignMemberValidator),
  handler: async (ctx): Promise<Array<CampaignMember>> => {
    return await getCampaignMembers(ctx)
  },
})

export const getCampaignRequests = dmQuery({
  args: {},
  returns: v.array(campaignMemberValidator),
  handler: async (ctx): Promise<Array<CampaignMember>> => {
    return await getCampaignRequestsFn(ctx)
  },
})
