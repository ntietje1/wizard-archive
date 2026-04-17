import { v } from 'convex/values'
import { authMutation, dmMutation } from '../functions'
import { usernameValidator } from '../users/validation'
import { createCampaign as createCampaignFn } from './functions/createCampaign'
import { joinCampaign as joinCampaignFn } from './functions/joinCampaign'
import { updateCampaign as updateCampaignFn } from './functions/updateCampaign'
import { deleteCampaign as deleteCampaignFn } from './functions/deleteCampaign'
import { updateCampaignMemberStatus as updateCampaignMemberStatusFn } from './functions/updateCampaignMemberStatus'
import { campaignMemberStatusValidator } from './schema'
import { campaignSlugValidator, requireCampaignSlug, requireCampaignUsername } from './validation'
import type { Id } from '../_generated/dataModel'
import type { CampaignMemberStatus } from './types'

export const createCampaign = authMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    slug: campaignSlugValidator,
  },
  returns: v.id('campaigns'),
  handler: async (ctx, args): Promise<Id<'campaigns'>> => {
    return createCampaignFn(ctx, {
      name: args.name,
      slug: requireCampaignSlug(args.slug),
      description: args.description,
    })
  },
})

export const joinCampaign = authMutation({
  args: {
    dmUsername: usernameValidator,
    slug: campaignSlugValidator,
  },
  returns: campaignMemberStatusValidator,
  handler: async (ctx, args): Promise<CampaignMemberStatus> => {
    return joinCampaignFn(ctx, {
      dmUsername: requireCampaignUsername(args.dmUsername),
      slug: requireCampaignSlug(args.slug),
    })
  },
})

export const updateCampaign = dmMutation({
  args: {
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    slug: v.optional(campaignSlugValidator),
  },
  returns: v.id('campaigns'),
  handler: async (ctx, args): Promise<Id<'campaigns'>> => {
    return updateCampaignFn(ctx, {
      name: args.name,
      description: args.description,
      slug: args.slug ? requireCampaignSlug(args.slug) : undefined,
    })
  },
})

export const deleteCampaign = dmMutation({
  args: {},
  returns: v.id('campaigns'),
  handler: async (ctx): Promise<Id<'campaigns'>> => {
    return deleteCampaignFn(ctx)
  },
})

export const updateCampaignMemberStatus = dmMutation({
  args: {
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
