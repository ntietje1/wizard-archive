import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
import { shareBlockWithMemberHelper } from './blockShareMutations'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const shareBlocks = async (
  ctx: AuthMutationCtx,
  {
    noteId,
    blocks,
    campaignMemberId,
  }: {
    noteId: Id<'notes'>
    blocks: Array<{ blockNoteId: string; content: any }>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<null> => {
  const rawNote = await ctx.db.get(noteId)
  const note = await requireItemAccess(ctx, {
    rawItem: rawNote,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await requireDmRole(ctx, note.campaignId)

  await Promise.all(
    blocks.map((blockItem) =>
      shareBlockWithMemberHelper(ctx, {
        note,
        blockItem,
        campaignMemberId,
      }),
    ),
  )

  return null
}
