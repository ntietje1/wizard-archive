import { v } from 'convex/values'
import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { authQuery, campaignQuery, dmQuery } from '../functions'
import { assertUsername, usernameValidator } from '../users/validation'
import { getCampaignMembers } from './functions/getCampaignMembers'
import { getCampaignRequests as getCampaignRequestsFn } from './functions/getCampaignRequests'
import {
  campaignMemberSummaryValidator,
  campaignMemberValidator,
  campaignValidator,
} from './schema'
import { getUserCampaigns as getUserCampaignsFn } from './functions/getUserCampaigns'
import {
  getCampaign as getCampaignFn,
  getCampaignBySlug as getCampaignBySlugFn,
} from './functions/getCampaign'
import { assertCampaignSlug, campaignSlugValidator } from './validation'

import type { PaginationResult } from 'convex/server'
import type { Campaign, CampaignMember, CampaignMemberSummary } from '../../shared/campaigns/types'

export const getUserCampaigns = authQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(campaignValidator),
  handler: async (ctx, args): Promise<PaginationResult<Campaign>> => {
    return await getUserCampaignsFn(ctx, args.paginationOpts)
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
      dmUsername: assertUsername(args.dmUsername),
      slug: assertCampaignSlug(args.slug),
    })
  },
})

export const getCampaignById = campaignQuery({
  args: {},
  returns: campaignValidator,
  handler: async (ctx): Promise<Campaign> => {
    const campaign = await getCampaignFn(ctx, { campaignId: ctx.campaign._id })
    if (!campaign) throw new Error('Campaign scope resolved a missing campaign')
    return campaign
  },
})

export const getMembersByCampaign = campaignQuery({
  args: {},
  returns: v.array(campaignMemberSummaryValidator),
  handler: async (ctx): Promise<Array<CampaignMemberSummary>> => {
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
