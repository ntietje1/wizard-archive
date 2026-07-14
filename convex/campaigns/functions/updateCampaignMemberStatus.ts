import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import type { DmMutationCtx } from '../../functions'
import type { CampaignMemberStatus } from '../../../shared/campaigns/types'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import { requireCampaignMemberRow } from './campaignIdentity'

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
  [CAMPAIGN_MEMBER_STATUS.Removed]: [CAMPAIGN_MEMBER_STATUS.Accepted],
}

export async function updateCampaignMemberStatus(
  ctx: DmMutationCtx,
  { memberId, status }: { memberId: CampaignMemberId; status: CampaignMemberStatus },
): Promise<CampaignMemberId> {
  const member = await requireCampaignMemberRow(ctx, memberId)

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

  return assertDomainId(DOMAIN_ID_KIND.campaignMember, member.campaignMemberUuid)
}
