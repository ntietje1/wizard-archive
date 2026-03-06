import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { shareBlockWithMemberHelper } from './blockShareMutations'
import { requireDmRole } from '../../functions'
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
  const note = await ctx.db.get(noteId)
  const item = await requireItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const campaignId = item.campaignId
  await requireDmRole(ctx, campaignId)

  await Promise.all(
    blocks.map((blockItem) =>
      shareBlockWithMemberHelper(ctx, {
        noteId,
        blockItem,
        campaignMemberId,
      }),
    ),
  )

  return null
}
