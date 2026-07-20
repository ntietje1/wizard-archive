import { v } from 'convex/values'
import { internalQuery } from '../_generated/server'
import { campaignIdValidator, campaignMemberIdValidator } from './schema'
import { requireCampaignAndMemberRows, requireCampaignRow } from './functions/campaignIdentity'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'

export const resolveCampaignRowId = internalQuery({
  args: { campaignId: campaignIdValidator },
  returns: v.id('campaigns'),
  handler: async (ctx, { campaignId }) =>
    (await requireCampaignRow(ctx, assertDomainId(DOMAIN_ID_KIND.campaign, campaignId)))._id,
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
    const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, args.campaignId)
    const campaignMemberId = assertDomainId(DOMAIN_ID_KIND.campaignMember, args.campaignMemberId)
    const { campaign, member } = await requireCampaignAndMemberRows(
      ctx,
      campaignId,
      campaignMemberId,
    )
    return { campaignId: campaign._id, campaignMemberId: member._id }
  },
})
