import type { WithoutSystemFields } from 'convex/server'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { ShareStatus } from '../../blockShares/types'
import type { BlockNoteId, BlockProps, BlockType, InlineContent } from '../types'

export async function updateBlock(
  ctx: CampaignMutationCtx,
  params: {
    blockDbId: Id<'blocks'>
    parentBlockId?: BlockNoteId | null
    depth?: number
    position?: number
    type?: BlockType
    props?: BlockProps
    inlineContent?: InlineContent | null
    plainText?: string | null
    shareStatus?: ShareStatus
  },
): Promise<void> {
  const { blockDbId, ...fields } = params
  const updates: Partial<WithoutSystemFields<Doc<'blocks'>>> = {}
  if (fields.parentBlockId !== undefined) updates.parentBlockId = fields.parentBlockId
  if (fields.depth !== undefined) updates.depth = fields.depth
  if (fields.position !== undefined) updates.position = fields.position
  if (fields.type !== undefined) updates.type = fields.type
  if (fields.props !== undefined) updates.props = fields.props
  if (fields.inlineContent !== undefined) updates.inlineContent = fields.inlineContent
  if (fields.plainText !== undefined) updates.plainText = fields.plainText
  if (fields.shareStatus !== undefined) updates.shareStatus = fields.shareStatus

  if (Object.keys(updates).length > 0) {
    await ctx.db.patch('blocks', blockDbId, {
      ...updates,
      updatedTime: Date.now(),
      updatedBy: ctx.membership.userId,
    })
  }
}
