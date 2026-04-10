import type { WithoutSystemFields } from 'convex/server'
import type { ShareStatus } from '../../blockShares/types'
import type { Doc, Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'
import type { CustomBlock } from '../../notes/editorSpecs'

export async function updateBlock(
  ctx: AuthMutationCtx,
  params: {
    blockDbId: Id<'blocks'>
    position?: number
    content?: CustomBlock
    isTopLevel?: boolean
    shareStatus?: ShareStatus
  },
): Promise<void> {
  const { blockDbId, ...fields } = params
  const updates: Partial<WithoutSystemFields<Doc<'blocks'>>> = {}
  if (fields.position !== undefined) updates.position = fields.position
  if (fields.content !== undefined) updates.content = fields.content
  if (fields.isTopLevel !== undefined) updates.isTopLevel = fields.isTopLevel
  if (fields.shareStatus !== undefined) updates.shareStatus = fields.shareStatus

  if (Object.keys(updates).length > 0) {
    await ctx.db.patch('blocks', blockDbId, {
      ...updates,
      updatedTime: Date.now(),
      updatedBy: ctx.user.profile._id,
    })
  }
}
