import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { DmMutationCtx } from '../../functions'
import type { CampaignMemberStatus } from '../types'

const VALID_STATUS_TRANSITIONS: Record<
  CampaignMemberStatus,
  ReadonlyArray<CampaignMemberStatus>
> = {
  [CAMPAIGN_MEMBER_STATUS.Pending]: [
    CAMPAIGN_MEMBER_STATUS.Accepted,
    CAMPAIGN_MEMBER_STATUS.Rejected,
  ],
  [CAMPAIGN_MEMBER_STATUS.Accepted]: [CAMPAIGN_MEMBER_STATUS.Removed],
  [CAMPAIGN_MEMBER_STATUS.Rejected]: [CAMPAIGN_MEMBER_STATUS.Accepted],
  [CAMPAIGN_MEMBER_STATUS.Removed]: [],
}

export async function updateCampaignMemberStatus(
  ctx: DmMutationCtx,
  { memberId, status }: { memberId: Id<'campaignMembers'>; status: CampaignMemberStatus },
): Promise<Id<'campaignMembers'>> {
  const member = await ctx.db.get('campaignMembers', memberId)
  if (!member) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Member not found')
  }

  if (member.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Member does not belong to this campaign')
  }

  if (member.role !== CAMPAIGN_MEMBER_ROLE.Player) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only player membership status can be changed')
  }

  const allowedTransitions = VALID_STATUS_TRANSITIONS[member.status]
  if (!allowedTransitions.includes(status)) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Cannot transition from ${member.status} to ${status}`,
    )
  }

  await ctx.db.patch('campaignMembers', member._id, {
    status,
  })

  return member._id
}
