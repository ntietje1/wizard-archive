import { v } from 'convex/values'
import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { authQuery, campaignQuery, checkCampaignMembership, dmQuery } from '../functions'
import { query } from '../_generated/server'
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
  getCampaignRowBySlug,
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

export const getCampaignInvitation = query({
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

export const getCampaignBySlug = authQuery({
  args: {
    dmUsername: usernameValidator,
    slug: campaignSlugValidator,
  },
  returns: campaignValidator,
  handler: async (ctx, args): Promise<Campaign> => {
    const identity = {
      dmUsername: assertUsername(args.dmUsername),
      slug: assertCampaignSlug(args.slug),
    }
    const row = await getCampaignRowBySlug(ctx, identity)
    await checkCampaignMembership(ctx, row._id)
    const campaign = await getCampaignFn(ctx, { campaignId: row._id })
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
