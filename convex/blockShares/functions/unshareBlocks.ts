import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { unshareBlockFromMemberHelper } from './blockShareMutations'
import { requireDmRole } from '../../functions'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const unshareBlocks = async (
  ctx: AuthMutationCtx,
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
  const item = await requireItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const campaignId = item.campaignId
  await requireDmRole(ctx, campaignId)

  for (const blockNoteId of blockNoteIds) {
    await unshareBlockFromMemberHelper(ctx, {
      noteId,
      blockNoteId,
      campaignMemberId,
    })
  }

  return null
}
