import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
import { getBlockSharePlayerNoteAccess } from '../../blockShares/functions/noteBlockShareEligibility'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { CampaignMember } from '../../../shared/campaigns/types'
import type { NoteFromDb } from '../../../shared/notes/types'

export async function getBlockSharePlayers(
  ctx: CampaignQueryCtx,
  note: NoteFromDb,
): Promise<{
  playerMembers: Array<CampaignMember>
  notePermissionByMemberId: Map<Id<'campaignMembers'>, PermissionLevel>
}> {
  const allMembers = await getCampaignMembers(ctx)
  const playerMembers = allMembers.filter((m) => m.role === CAMPAIGN_MEMBER_ROLE.Player)
  const accessRows = await getBlockSharePlayerNoteAccess(ctx, {
    note,
    candidateMemberIds: playerMembers.map((m) => m._id),
  })
  const notePermissionByMemberId = new Map(
    accessRows.map((row) => [row.memberId, row.notePermissionLevel]),
  )

  return {
    playerMembers,
    notePermissionByMemberId,
  }
}
