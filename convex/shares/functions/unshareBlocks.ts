import { requireItemAccess } from '../../sidebarItems/validation'
import { unshareBlockFromMemberHelper } from '../blockShares'
import { PERMISSION_LEVEL } from '../types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const unshareBlocks = async (
  ctx: CampaignMutationCtx,
  {
    noteId,
    blockNoteIds,
    campaignMemberId,
  }: {
    noteId: Id<'notes'>
    blockNoteIds: Array<string>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<null> => {
  const note = await ctx.db.get(noteId)
  await requireItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  for (const blockNoteId of blockNoteIds) {
    await unshareBlockFromMemberHelper(ctx, {
      noteId,
      blockNoteId,
      campaignMemberId,
    })
  }

  return null
}
