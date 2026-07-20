import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { QueryCtx } from '../../_generated/server'
import type { CampaignId, CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'

type CampaignIdentityCtx = Pick<QueryCtx, 'db'>

export async function findCampaignRow(ctx: CampaignIdentityCtx, campaignId: CampaignId) {
  return await ctx.db
    .query('campaigns')
    .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
    .unique()
}

export async function requireCampaignRow(ctx: CampaignIdentityCtx, campaignId: CampaignId) {
  const campaign = await findCampaignRow(ctx, assertDomainId(DOMAIN_ID_KIND.campaign, campaignId))
  if (!campaign) throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign not found')
  return campaign
}

export async function requireCampaignMemberRow(
  ctx: CampaignIdentityCtx,
  campaignMemberId: CampaignMemberId,
) {
  const memberId = assertDomainId(DOMAIN_ID_KIND.campaignMember, campaignMemberId)
  const member = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaignMemberUuid', (query) => query.eq('campaignMemberUuid', memberId))
    .unique()
  if (!member) throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign member not found')
  return member
}

export async function requireCampaignMemberRowForCampaign(
  ctx: CampaignIdentityCtx,
  campaignId: CampaignId,
  campaignMemberId: CampaignMemberId,
) {
  return (await requireCampaignAndMemberRows(ctx, campaignId, campaignMemberId)).member
}

export async function requireCampaignAndMemberRows(
  ctx: CampaignIdentityCtx,
  campaignId: CampaignId,
  campaignMemberId: CampaignMemberId,
) {
  const [campaign, member] = await Promise.all([
    requireCampaignRow(ctx, campaignId),
    requireCampaignMemberRow(ctx, campaignMemberId),
  ])
  if (member.campaignId !== campaign._id) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign member not found')
  }
  return { campaign, member }
}
