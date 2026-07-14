import { v } from 'convex/values'
import { internalQuery } from '../_generated/server'
import { campaignIdValidator, campaignMemberIdValidator } from './schema'
import { requireCampaignMemberRow, requireCampaignRow } from './functions/campaignIdentity'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'

export const resolveCampaignRowId = internalQuery({
  args: { campaignId: campaignIdValidator },
  returns: v.id('campaigns'),
  handler: async (ctx, { campaignId }) => (await requireCampaignRow(ctx, campaignId))._id,
})

export const resolveCampaignAndMemberRowIds = internalQuery({
  args: {
    campaignId: campaignIdValidator,
    campaignMemberId: campaignMemberIdValidator,
  },
  returns: v.object({
    campaignId: v.id('campaigns'),
    campaignMemberId: v.id('campaignMembers'),
  }),
  handler: async (ctx, args) => {
    const [campaign, member] = await Promise.all([
      requireCampaignRow(ctx, args.campaignId),
      requireCampaignMemberRow(ctx, args.campaignMemberId),
    ])
    if (member.campaignId !== campaign._id) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign member not found')
    }
    return { campaignId: campaign._id, campaignMemberId: member._id }
  },
})
