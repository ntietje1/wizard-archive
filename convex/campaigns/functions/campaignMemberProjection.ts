import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, UserProfileId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberRow } from '../rows'

export function toCampaignMemberProjection<TProfile>(
  member: CampaignMemberRow,
  campaignId: CampaignId,
  userId: UserProfileId,
  userProfile: TProfile,
) {
  return {
    id: assertDomainId(DOMAIN_ID_KIND.campaignMember, member.campaignMemberUuid),
    campaignId,
    userId,
    createdAt: member._creationTime,
    role: member.role,
    status: member.status,
    userProfile,
  }
}
