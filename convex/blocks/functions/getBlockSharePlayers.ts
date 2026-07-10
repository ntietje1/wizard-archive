import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
import { getBlockSharePlayerNoteAccess } from '../../blockShares/functions/noteBlockShareEligibility'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { CampaignMemberSummary } from '../../../shared/campaigns/types'
import type { NoteItemRow } from '@wizard-archive/editor/notes/item-contract'

export async function getBlockSharePlayers(
  ctx: CampaignQueryCtx,
  note: NoteItemRow,
): Promise<{
  playerMembers: Array<CampaignMemberSummary>
  notePermissionByMemberId: Map<Id<'campaignMembers'>, PermissionLevel>
}> {
  const allMembers = await getCampaignMembers(ctx)
  const playerMembers = allMembers.filter((m) => m.role === CAMPAIGN_MEMBER_ROLE.Player)
  const accessRows = await getBlockSharePlayerNoteAccess(ctx, {
    note,
    candidateMemberIds: playerMembers.map((m) => m.id),
  })
  const notePermissionByMemberId = new Map(
    accessRows.map((row) => [row.memberId, row.notePermissionLevel]),
  )

  return {
    playerMembers,
    notePermissionByMemberId,
  }
}
