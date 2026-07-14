import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
import { getBlockSharePlayerNoteAccess } from '../../blockShares/functions/noteBlockShareEligibility'
import type { CampaignQueryCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { CampaignMemberSummary } from '../../../shared/campaigns/types'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'

export async function getBlockSharePlayers(
  ctx: CampaignQueryCtx,
  note: Doc<'sidebarItems'>,
): Promise<{
  playerMembers: Array<CampaignMemberSummary>
  memberIdByRowId: Map<Id<'campaignMembers'>, CampaignMemberId>
  notePermissionByMemberId: Map<CampaignMemberId, PermissionLevel>
}> {
  const allMembers = await getCampaignMembers(ctx)
  const playerMembers = allMembers.filter((m) => m.role === CAMPAIGN_MEMBER_ROLE.Player)
  const playerMemberIds = new Set(playerMembers.map((member) => member.id))
  const memberRows = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (query) => query.eq('campaignId', ctx.campaign._id))
    .collect()
  const playerMemberRows = memberRows.filter((member) =>
    playerMemberIds.has(assertDomainId(DOMAIN_ID_KIND.campaignMember, member.campaignMemberUuid)),
  )
  const memberIdByRowId = new Map(
    playerMemberRows.map((member) => [
      member._id,
      assertDomainId(DOMAIN_ID_KIND.campaignMember, member.campaignMemberUuid),
    ]),
  )
  const accessRows = await getBlockSharePlayerNoteAccess(ctx, {
    note,
    candidateMemberIds: playerMemberRows.map((member) => member._id),
  })
  const notePermissionByMemberId = new Map(
    accessRows.map((row) => [memberIdByRowId.get(row.memberId)!, row.notePermissionLevel]),
  )

  return {
    playerMembers,
    memberIdByRowId,
    notePermissionByMemberId,
  }
}
