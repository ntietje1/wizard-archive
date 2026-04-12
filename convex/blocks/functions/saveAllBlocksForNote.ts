import { asyncMap } from 'convex-helpers'
import { ERROR_CODE, throwClientError } from '../../errors'
import { SHARE_STATUS } from '../../blockShares/types'
import { flattenBlocks } from './flattenBlocks'
import { insertBlock } from './insertBlock'
import { updateBlock } from './updateBlock'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { CustomBlock } from '../../notes/editorSpecs'

export async function saveAllBlocksForNote(
  ctx: CampaignMutationCtx,
  { noteId, content }: { noteId: Id<'sidebarItems'>; content: Array<CustomBlock> },
): Promise<void> {
  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (note.deletionTime !== null) return
  const campaignId = note.campaignId

  const existingBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note', (q) => q.eq('campaignId', campaignId).eq('noteId', noteId))
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()

  const existingBlocksMap = new Map(existingBlocks.map((block) => [block.blockId, block]))

  const flatBlocks = flattenBlocks(content)
  const incomingBlockIds = new Set(flatBlocks.map((b) => b.blockId))

  await asyncMap(flatBlocks, async (flat) => {
    const existing = existingBlocksMap.get(flat.blockId)
    if (existing) {
      await updateBlock(ctx, {
        blockDbId: existing._id,
        parentBlockId: flat.parentBlockId,
        depth: flat.depth,
        position: flat.position,
        type: flat.type,
        props: flat.props,
        inlineContent: flat.inlineContent,
        plainText: flat.plainText,
      })
    } else {
      await insertBlock(ctx, {
        noteId,
        campaignId,
        blockId: flat.blockId,
        parentBlockId: flat.parentBlockId,
        depth: flat.depth,
        position: flat.position,
        type: flat.type,
        props: flat.props,
        inlineContent: flat.inlineContent,
        plainText: flat.plainText,
        shareStatus: SHARE_STATUS.NOT_SHARED,
      })
    }
  })

  // hard delete blocks that don't exist in the document anymore
  const blocksToDelete = existingBlocks.filter((b) => !incomingBlockIds.has(b.blockId))
  await asyncMap(blocksToDelete, async (block) => {
    const blockShares = await ctx.db
      .query('blockShares')
      .withIndex('by_campaign_block_member', (q) =>
        q.eq('campaignId', campaignId).eq('blockId', block._id),
      )
      .filter((q) => q.eq(q.field('deletionTime'), null))
      .collect()

    await asyncMap(blockShares, (share) => ctx.db.delete(share._id))
    await ctx.db.delete(block._id)
  })
}
