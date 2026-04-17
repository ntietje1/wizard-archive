import { v } from 'convex/values'
import { authQuery, campaignQuery, dmQuery } from '../functions'
import { usernameValidator } from '../users/validation'
import { getCampaignMembers } from './functions/getCampaignMembers'
import { getCampaignRequests as getCampaignRequestsFn } from './functions/getCampaignRequests'
import { campaignMemberValidator, campaignValidator } from './schema'
import { getUserCampaigns as getUserCampaignsFn } from './functions/getUserCampaigns'
import { getCampaignBySlug as getCampaignBySlugFn } from './functions/getCampaign'
import { campaignSlugValidator, requireCampaignSlug, requireCampaignUsername } from './validation'

import type { Campaign, CampaignMember } from './types'

export const getUserCampaigns = authQuery({
  args: {},
  returns: v.array(campaignValidator),
  handler: async (ctx): Promise<Array<Campaign>> => {
    return await getUserCampaignsFn(ctx)
  },
})

export const getCampaignBySlug = authQuery({
  args: {
    dmUsername: usernameValidator,
    slug: campaignSlugValidator,
  },
  returns: campaignValidator,
  handler: async (ctx, args): Promise<Campaign> => {
    return await getCampaignBySlugFn(ctx, {
      dmUsername: requireCampaignUsername(args.dmUsername),
      slug: requireCampaignSlug(args.slug),
    })
  },
})

export const getMembersByCampaign = campaignQuery({
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
