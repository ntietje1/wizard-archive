import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
import { getNoteEligibleBlockShareMemberIds } from '../../blockShares/functions/noteBlockShareEligibility'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMember } from '../../../shared/campaigns/types'
import type { NoteFromDb } from '../../../shared/notes/types'

export async function getEligibleBlockSharePlayers(
  ctx: CampaignQueryCtx,
  note: NoteFromDb,
): Promise<{
  eligibleMemberIds: Set<Id<'campaignMembers'>>
  playerMembers: Array<CampaignMember>
}> {
  const allMembers = await getCampaignMembers(ctx)
  const playerMembers = allMembers.filter((m) => m.role === CAMPAIGN_MEMBER_ROLE.Player)
  const eligibleMemberIds = await getNoteEligibleBlockShareMemberIds(ctx, {
    note,
    candidateMemberIds: playerMembers.map((m) => m._id),
  })

  return {
    eligibleMemberIds,
    playerMembers: playerMembers.filter((m) => eligibleMemberIds.has(m._id)),
  }
}
