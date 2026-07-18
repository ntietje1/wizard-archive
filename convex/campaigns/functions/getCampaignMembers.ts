import { CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { logger } from '../../common/logger'
import { toUserProfileSummary } from '../../users/functions/profileSummary'
import {
  CAMPAIGN_MEMBER_PRESENTATION_PAGE_SIZE,
  getAcceptedPlayerPage,
  getCampaignMemberRows,
  loadProfilesByMemberUserId,
} from './campaignMemberProfiles'
import type { CampaignQueryCtx } from '../../functions'
import type { CampaignMemberSummary } from '../../../shared/campaigns/types'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { toCampaignMemberProjection } from './campaignMemberProjection'

export async function getCampaignMembers(
  ctx: CampaignQueryCtx,
): Promise<Array<CampaignMemberSummary>> {
  const members = await getCampaignMemberRows(ctx)
  const activeMembers = members.filter((m) => m.status === CAMPAIGN_MEMBER_STATUS.Accepted)
  const profilesByUserId = await loadProfilesByMemberUserId(ctx, activeMembers)
  const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, ctx.campaign.campaignUuid)
  return activeMembers.flatMap((member) => {
    const profile = profilesByUserId.get(member.userId)
    if (!profile) {
      logger.warn(`User profile not found for userId: ${member.userId}`)
      return []
    }
    return [
      toCampaignMemberProjection(member, campaignId, profile.id, toUserProfileSummary(profile)),
    ]
  })
}

export async function getAcceptedPlayerPresentationPage(
  ctx: CampaignQueryCtx,
  cursor: string | null,
  pageSize = CAMPAIGN_MEMBER_PRESENTATION_PAGE_SIZE,
) {
  const page = await getAcceptedPlayerPage(ctx, cursor, pageSize)
  const profilesByUserId = await loadProfilesByMemberUserId(ctx, page.members)
  const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, ctx.campaign.campaignUuid)
  return {
    cursor: page.cursor,
    participants: page.members.flatMap((member) => {
      const profile = profilesByUserId.get(member.userId)
      if (!profile) {
        logger.warn(`User profile not found for userId: ${member.userId}`)
        return []
      }
      const projection = toCampaignMemberProjection(
        member,
        campaignId,
        profile.id,
        toUserProfileSummary(profile),
      )
      return [
        {
          id: projection.id,
          displayName: projection.userProfile.name?.trim() || projection.userProfile.username,
          username: projection.userProfile.username,
          imageUrl: projection.userProfile.imageUrl,
        },
      ]
    }),
  }
}
