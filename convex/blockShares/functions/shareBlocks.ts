import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { shareBlockWithMemberHelper } from './blockShareMutations'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const shareBlocks = async (
  ctx: CampaignMutationCtx,
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
  await requireItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

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
