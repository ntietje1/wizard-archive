import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberRow } from '../../../shared/campaigns/types'

export function toCampaignMemberProjection<TProfile>(
  member: CampaignMemberRow,
  campaignId: CampaignId,
  userProfile: TProfile,
) {
  const {
    _id: _rowId,
    _creationTime,
    campaignMemberUuid,
    campaignId: _campaignRowId,
    ...fields
  } = member
  return {
    ...fields,
    id: assertDomainId(DOMAIN_ID_KIND.campaignMember, campaignMemberUuid),
    campaignId,
    createdAt: _creationTime,
    userProfile,
  }
}
