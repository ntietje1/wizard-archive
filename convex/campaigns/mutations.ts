import { v } from 'convex/values'
import { authMutation, dmMutation } from '../functions'
import { assertUsername, usernameValidator } from '../users/validation'
import { createCampaign as createCampaignFn } from './functions/createCampaign'
import { joinCampaign as joinCampaignFn } from './functions/joinCampaign'
import { hardDeleteCampaign } from './functions/lifecycle'
import { updateCampaign as updateCampaignFn } from './functions/updateCampaign'
import { updateCampaignMemberStatus as updateCampaignMemberStatusFn } from './functions/updateCampaignMemberStatus'
import {
  campaignIdValidator,
  campaignMemberIdValidator,
  campaignMemberStatusValidator,
} from './schema'
import { assertCampaignSlug, campaignSlugValidator } from './validation'
import type { CampaignMemberStatus } from '../../shared/campaigns/types'
import type { CampaignId, CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'

export const createCampaign = authMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    slug: campaignSlugValidator,
  },
  returns: campaignIdValidator,
  handler: async (ctx, args): Promise<CampaignId> => {
    return createCampaignFn(ctx, {
      name: args.name,
      slug: assertCampaignSlug(args.slug),
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
      dmUsername: assertUsername(args.dmUsername),
      slug: assertCampaignSlug(args.slug),
    })
  },
})

export const updateCampaign = dmMutation({
  args: {
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    slug: v.optional(campaignSlugValidator),
    defaultFolderInheritShares: v.optional(v.boolean()),
  },
  returns: campaignIdValidator,
  handler: async (ctx, args): Promise<CampaignId> => {
    return updateCampaignFn(ctx, {
      name: args.name,
      description: args.description,
      slug: args.slug ? assertCampaignSlug(args.slug) : undefined,
      defaultFolderInheritShares: args.defaultFolderInheritShares,
    })
  },
})

export const deleteCampaign = dmMutation({
  args: {},
  returns: campaignIdValidator,
  handler: async (ctx): Promise<CampaignId> => {
    const campaignId = ctx.resourceScope.campaignId
    await hardDeleteCampaign(ctx, ctx.campaign._id, campaignId)
    return campaignId
  },
})

export const updateCampaignMemberStatus = dmMutation({
  args: {
    memberId: campaignMemberIdValidator,
    status: campaignMemberStatusValidator,
  },
  returns: campaignMemberIdValidator,
  handler: async (ctx, args): Promise<CampaignMemberId> => {
    return updateCampaignMemberStatusFn(ctx, {
      memberId: args.memberId,
      status: args.status,
    })
  },
})
