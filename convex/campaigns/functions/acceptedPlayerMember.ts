import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'

export async function requireCampaignMember(
  ctx: Pick<QueryCtx, 'db'>,
  {
    campaignId,
    campaignMemberId,
  }: {
    campaignId: Id<'campaigns'>
    campaignMemberId: Id<'campaignMembers'>
  },
) {
  const member = await ctx.db.get('campaignMembers', campaignMemberId)
  if (!member || member.campaignId !== campaignId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Member does not belong to this campaign')
  }
  return member
}

export async function requireAcceptedPlayerMember(
  ctx: Pick<QueryCtx, 'db'>,
  args: {
    campaignId: Id<'campaigns'>
    campaignMemberId: Id<'campaignMembers'>
  },
) {
  const member = await requireCampaignMember(ctx, args)
  if (
    member.role !== CAMPAIGN_MEMBER_ROLE.Player ||
    member.status !== CAMPAIGN_MEMBER_STATUS.Accepted
  ) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only accepted players can receive shares')
  }
  return member
}
