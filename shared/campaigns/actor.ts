import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from './types'
import type { CampaignMemberSummary } from './types'
import type { CampaignId, CampaignMemberId } from '../common/ids'

export type CampaignActor =
  | { kind: 'dm'; campaignId: CampaignId }
  | { kind: 'dm_view_as'; campaignId: CampaignId; memberId: CampaignMemberId }
  | { kind: 'player'; campaignId: CampaignId }

export interface CampaignViewAsSelection {
  campaignId: CampaignId
  memberId: CampaignMemberId
}

export function getCampaignActorViewAsMemberId(actor: CampaignActor | null) {
  return actor?.kind === 'dm_view_as' ? actor.memberId : undefined
}

export function resolveCampaignActor({
  campaignId,
  isDm,
  viewAsPlayer,
  members,
}: {
  campaignId: CampaignId | undefined
  isDm: boolean | undefined
  viewAsPlayer: CampaignViewAsSelection | null
  members: Array<CampaignMemberSummary> | undefined
}): CampaignActor | null {
  if (!campaignId || isDm === undefined) return null
  if (!isDm) return { kind: 'player', campaignId }

  if (viewAsPlayer?.campaignId !== campaignId) {
    return { kind: 'dm', campaignId }
  }

  const selectedMember = members?.find(
    (member) =>
      member._id === viewAsPlayer.memberId &&
      member.campaignId === campaignId &&
      member.role === CAMPAIGN_MEMBER_ROLE.Player &&
      member.status === CAMPAIGN_MEMBER_STATUS.Accepted,
  )

  if (!selectedMember) {
    return { kind: 'dm', campaignId }
  }

  return { kind: 'dm_view_as', campaignId, memberId: selectedMember._id }
}
