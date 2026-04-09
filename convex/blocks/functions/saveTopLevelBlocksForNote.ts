import { ERROR_CODE, throwClientError } from '../../errors'
import { SHARE_STATUS } from '../../blockShares/types'
import { insertBlock } from './insertBlock'
import { updateBlock } from './updateBlock'
import { removeBlockIfNotNeeded } from './removeBlockIfNotNeeded'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'
import type { CustomBlock } from '../../notes/editorSpecs'

export async function saveTopLevelBlocksForNote(
  ctx: AuthMutationCtx,
  { noteId, content }: { noteId: Id<'notes'>; content: Array<CustomBlock> },
): Promise<void> {
  const note = await ctx.db.get("notes", noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  const campaignId = note.campaignId

  const existingTopLevelBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_topLevel', (q) =>
      q.eq('campaignId', campaignId).eq('noteId', noteId).eq('isTopLevel', true),
    )
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()

  const existingBlocksMap = new Map(existingTopLevelBlocks.map((block) => [block.blockId, block]))

  const positions = new Map<string, number>()
  content.forEach((block, index) => positions.set(block.id, index))

  await Promise.all(
    content.map((block) => {
      const existingBlock = existingBlocksMap.get(block.id)
      if (existingBlock) {
        return updateBlock(ctx, {
          blockDbId: existingBlock._id,
          position: positions.get(block.id),
          content: block,
          isTopLevel: existingBlock.isTopLevel,
        })
      }
      return insertBlock(ctx, {
        noteId,
        campaignId,
        blockId: block.id,
        isTopLevel: true,
        position: positions.get(block.id) ?? null,
        content: block,
        shareStatus: SHARE_STATUS.NOT_SHARED,
      })
    }),
  )
  const remainingBlocks = existingTopLevelBlocks.filter(
    (b) => !content.some((b2) => b2.id === b.blockId),
  )
  await Promise.all(
    remainingBlocks.map(async (block) => {
      await ctx.db.patch("blocks", block._id, { isTopLevel: false })
      await removeBlockIfNotNeeded(ctx, { blockId: block._id })
    }),
  )
}
