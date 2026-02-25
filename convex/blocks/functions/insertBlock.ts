import { SHARE_STATUS } from '../../blockShares/types'
import type { ShareStatus } from '../../blockShares/types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { CustomBlock } from '../../notes/editorSpecs'

export async function insertBlock(
  ctx: CampaignMutationCtx,
  params: {
    noteId: Id<'notes'>
    campaignId: Id<'campaigns'>
    blockId: string
    isTopLevel: boolean
    position: number | null
    content: CustomBlock
    shareStatus: ShareStatus
  },
): Promise<Id<'blocks'>> {
  const now = Date.now()
  return await ctx.db.insert('blocks', {
    noteId: params.noteId,
    campaignId: params.campaignId,
    blockId: params.blockId,
    position: params.position ?? undefined,
    content: params.content,
    isTopLevel: params.isTopLevel,
    shareStatus: params.shareStatus ?? SHARE_STATUS.NOT_SHARED,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
    createdBy: ctx.user.profile._id,
  })
}
