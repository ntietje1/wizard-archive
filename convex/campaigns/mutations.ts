import { v } from 'convex/values'
import { authMutation, dmMutation } from '../functions'
import { createCampaign as createCampaignFn } from './functions/createCampaign'
import { joinCampaign as joinCampaignFn } from './functions/joinCampaign'
import { updateCampaign as updateCampaignFn } from './functions/updateCampaign'
import { deleteCampaign as deleteCampaignFn } from './functions/deleteCampaign'
import { updateCampaignMemberStatus as updateCampaignMemberStatusFn } from './functions/updateCampaignMemberStatus'
import { campaignMemberStatusValidator } from './schema'
import type { Id } from '../_generated/dataModel'
import type { CampaignMemberStatus } from './types'

export const createCampaign = authMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    slug: v.string(),
  },
  returns: v.id('campaigns'),
  handler: async (ctx, args): Promise<Id<'campaigns'>> => {
    return createCampaignFn(ctx, {
      name: args.name,
      slug: args.slug,
      description: args.description,
    })
  },
})

export const joinCampaign = authMutation({
  args: {
    dmUsername: v.string(),
    slug: v.string(),
  },
  returns: campaignMemberStatusValidator,
  handler: async (ctx, args): Promise<CampaignMemberStatus> => {
    return joinCampaignFn(ctx, {
      dmUsername: args.dmUsername,
      slug: args.slug,
    })
  },
})

export const updateCampaign = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  returns: v.id('campaigns'),
  handler: async (ctx, args): Promise<Id<'campaigns'>> => {
    return updateCampaignFn(ctx, {
      name: args.name,
      description: args.description,
      slug: args.slug,
    })
  },
})

export const deleteCampaign = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.id('campaigns'),
  handler: async (ctx): Promise<Id<'campaigns'>> => {
    return deleteCampaignFn(ctx)
  },
})

export const updateCampaignMemberStatus = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    memberId: v.id('campaignMembers'),
    status: campaignMemberStatusValidator,
  },
  returns: v.id('campaignMembers'),
  handler: async (ctx, args): Promise<Id<'campaignMembers'>> => {
    return updateCampaignMemberStatusFn(ctx, {
      memberId: args.memberId,
      status: args.status,
    })
  },
})
