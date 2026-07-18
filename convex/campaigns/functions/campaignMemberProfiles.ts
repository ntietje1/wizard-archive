import { asyncMap } from 'convex-helpers'
import { getUserProfileById } from '../../users/functions/getUserProfile'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMemberRow } from '../rows'
import type { UserProfile } from '../../../shared/users/types'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'

type CampaignMemberProfileCtx = CampaignQueryCtx
export const CAMPAIGN_MEMBER_PRESENTATION_PAGE_SIZE = 16

export async function getAcceptedPlayerPage(
  ctx: CampaignMemberProfileCtx,
  cursor: string | null,
  pageSize: number,
) {
  const page = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_status_role_member', (query) =>
      query
        .eq('campaignId', ctx.campaign._id)
        .eq('status', CAMPAIGN_MEMBER_STATUS.Accepted)
        .eq('role', CAMPAIGN_MEMBER_ROLE.Player),
    )
    .paginate({ cursor, numItems: pageSize })
  return {
    members: page.page,
    cursor: page.isDone ? null : page.continueCursor,
  }
}

export async function getCampaignMemberRows(
  ctx: CampaignMemberProfileCtx,
): Promise<Array<CampaignMemberRow>> {
  return await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', ctx.campaign._id))
    .collect()
}

export async function loadProfilesByMemberUserId(
  ctx: CampaignMemberProfileCtx,
  members: Array<CampaignMemberRow>,
): Promise<Map<Id<'userProfiles'>, UserProfile>> {
  const profilesByUserId = new Map<Id<'userProfiles'>, UserProfile>()
  await asyncMap(members, async (member) => {
    const profile = await getUserProfileById(ctx, { profileId: member.userId })
    if (profile) profilesByUserId.set(member.userId, profile)
  })
  return profilesByUserId
}
