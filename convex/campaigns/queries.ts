import { v } from 'convex/values'
import { authQuery, campaignQuery } from '../functions'
import { getCampaignMembers } from './functions/getCampaignMembers'
import { campaignMemberValidator, campaignValidator } from './schema'
import { getUserCampaigns as getUserCampaignsFn } from './functions/getUserCampaigns'
import { getCampaignBySlug as getCampaignBySlugFn } from './functions/getCampaign'
import { checkCampaignSlugExists as checkCampaignSlugExistsFn } from './functions/checkCampaignSlugExists'
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
    return getCampaignBySlugFn(ctx, args.dmUsername, args.slug)
  },
})

export const checkCampaignSlugExists = authQuery({
  args: {
    slug: v.string(),
    excludeCampaignId: v.optional(v.id('campaigns')),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    return await checkCampaignSlugExistsFn(
      ctx,
      args.slug,
      args.excludeCampaignId,
    )
  },
})

export const getPlayersByCampaign = campaignQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.array(campaignMemberValidator),
  handler: async (ctx): Promise<Array<CampaignMember>> => {
    return getCampaignMembers(ctx)
  },
})
