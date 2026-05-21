import type { WithoutSystemFields } from 'convex/server'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { SHARE_STATUS_VALUES } from '../../blockShares/types'
import type { ShareStatus } from '../../blockShares/types'
import type { BlockNoteId } from '../types'

type BlockMetadataPatch = {
  blockDbId: Id<'blocks'>
  parentBlockId?: BlockNoteId | null
  depth?: number
  position?: number | null
  plainText?: string
  shareStatus?: ShareStatus
}

export async function patchBlockMetadata(
  ctx: Pick<MutationCtx, 'db'>,
  params: BlockMetadataPatch,
): Promise<void> {
  const { blockDbId, ...fields } = params
  const updates: Partial<WithoutSystemFields<Doc<'blocks'>>> = {}
  if (fields.parentBlockId !== undefined) updates.parentBlockId = fields.parentBlockId
  if (fields.depth !== undefined) {
    if (fields.depth < 0) throw new Error('depth must be non-negative')
    updates.depth = fields.depth
  }
  if (fields.position !== undefined) updates.position = fields.position
  if (fields.plainText !== undefined) updates.plainText = fields.plainText
  if (fields.shareStatus !== undefined) {
    if (!SHARE_STATUS_VALUES.includes(fields.shareStatus)) {
      throw new Error(`Invalid block shareStatus: ${fields.shareStatus}`)
    }
    updates.shareStatus = fields.shareStatus
  }

  if (Object.keys(updates).length > 0) {
    await ctx.db.patch('blocks', blockDbId, updates)
  }
}
