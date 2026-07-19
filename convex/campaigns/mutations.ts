import { v } from 'convex/values'
import { authMutation, dmMutation } from '../functions'
import { createCampaign as createCampaignFn } from './functions/createCampaign'
import { joinCampaign as joinCampaignFn } from './functions/joinCampaign'
import { beginCampaignDeletion } from './functions/lifecycle'
import { updateCampaign as updateCampaignFn } from './functions/updateCampaign'
import { updateCampaignMemberStatus as updateCampaignMemberStatusFn } from './functions/updateCampaignMemberStatus'
import {
  campaignIdValidator,
  campaignMemberIdValidator,
  campaignMemberStatusValidator,
} from './schema'
import type { CampaignMemberStatus } from '../../shared/campaigns/types'
import type { CampaignId, CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import { FOLDER_ACCESS_INHERITANCE } from '@wizard-archive/editor/resources/access-policy'

export const createCampaign = authMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: campaignIdValidator,
  handler: async (ctx, args): Promise<CampaignId> => {
    return createCampaignFn(ctx, {
      name: args.name,
      description: args.description,
    })
  },
})

export const joinCampaign = authMutation({
  args: {
    campaignId: campaignIdValidator,
  },
  returns: campaignMemberStatusValidator,
  handler: async (ctx, args): Promise<CampaignMemberStatus> => {
    return joinCampaignFn(ctx, { campaignId: args.campaignId })
  },
})

export const updateCampaign = dmMutation({
  args: {
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    resourceAccessDefaults: v.optional(
      v.object({
        folderInheritance: v.union(
          v.literal(FOLDER_ACCESS_INHERITANCE.disabled),
          v.literal(FOLDER_ACCESS_INHERITANCE.enabled),
        ),
      }),
    ),
  },
  returns: campaignIdValidator,
  handler: async (ctx, args): Promise<CampaignId> => {
    return updateCampaignFn(ctx, {
      name: args.name,
      description: args.description,
      resourceAccessDefaults: args.resourceAccessDefaults,
    })
  },
})

export const deleteCampaign = dmMutation({
  args: {},
  returns: campaignIdValidator,
  handler: async (ctx): Promise<CampaignId> => {
    const campaignId = ctx.resourceScope.campaignId
    await beginCampaignDeletion(ctx, ctx.campaign)
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
