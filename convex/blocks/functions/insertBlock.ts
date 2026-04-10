import { SHARE_STATUS } from '../../blockShares/types'
import type { ShareStatus } from '../../blockShares/types'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'
import type { CustomBlock } from '../../notes/editorSpecs'

export async function insertBlock(
  ctx: AuthMutationCtx,
  params: {
    noteId: Id<'sidebarItems'>
    campaignId: Id<'campaigns'>
    blockId: string
    isTopLevel: boolean
    position: number | null
    content: CustomBlock
    shareStatus: ShareStatus
  },
): Promise<Id<'blocks'>> {
  return await ctx.db.insert('blocks', {
    noteId: params.noteId,
    campaignId: params.campaignId,
    blockId: params.blockId,
    position: params.position,
    content: params.content,
    isTopLevel: params.isTopLevel,
    shareStatus: params.shareStatus ?? SHARE_STATUS.NOT_SHARED,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: ctx.user.profile._id,
  })
}
