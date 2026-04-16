import { asyncMap } from 'convex-helpers'
import { ERROR_CODE, throwClientError } from '../../errors'
import { SHARE_STATUS } from '../../blockShares/types'
import { flattenBlocks } from './flattenBlocks'
import { insertBlock } from './insertBlock'
import { updateBlock } from './updateBlock'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { CustomBlock } from '../../notes/editorSpecs'
import type { PersistedBlockRecord } from '../types'

export async function saveAllBlocksForNote(
  ctx: CampaignMutationCtx,
  { noteId, content }: { noteId: Id<'sidebarItems'>; content: Array<CustomBlock> },
): Promise<Array<PersistedBlockRecord>> {
  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (note.deletionTime !== null) return []
  const campaignId = note.campaignId

  const existingBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) => q.eq('campaignId', campaignId).eq('noteId', noteId))
    .collect()

  const existingBlocksMap = new Map(existingBlocks.map((block) => [block.blockNoteId, block]))

  const rawFlatBlocks = flattenBlocks(content)
  const deduped = new Map<string, (typeof rawFlatBlocks)[number]>()
  for (const flat of rawFlatBlocks) {
    if (deduped.has(flat.blockNoteId)) {
      console.warn(
        `[saveAllBlocksForNote] Duplicate blockNoteId "${flat.blockNoteId}" in note ${noteId}, keeping first occurrence`,
      )
    } else {
      deduped.set(flat.blockNoteId, flat)
    }
  }
  const flatBlocks = [...deduped.values()]
  const incomingBlockIds = new Set(flatBlocks.map((b) => b.blockNoteId))
  const persistedBlocks = await asyncMap(
    flatBlocks,
    async (flat): Promise<PersistedBlockRecord> => {
      const existing = existingBlocksMap.get(flat.blockNoteId)
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
        return {
          _id: existing._id,
          noteId,
          campaignId,
          blockNoteId: flat.blockNoteId,
          parentBlockId: flat.parentBlockId,
          depth: flat.depth,
          position: flat.position,
          type: flat.type,
          props: flat.props,
          inlineContent: flat.inlineContent,
          plainText: flat.plainText,
          shareStatus: existing.shareStatus,
        }
      }

      const blockId = await insertBlock(ctx, {
        noteId,
        campaignId,
        blockNoteId: flat.blockNoteId,
        parentBlockId: flat.parentBlockId,
        depth: flat.depth,
        position: flat.position,
        type: flat.type,
        props: flat.props,
        inlineContent: flat.inlineContent,
        plainText: flat.plainText,
        shareStatus: SHARE_STATUS.NOT_SHARED,
      })

      return {
        _id: blockId,
        noteId,
        campaignId,
        blockNoteId: flat.blockNoteId,
        parentBlockId: flat.parentBlockId,
        depth: flat.depth,
        position: flat.position,
        type: flat.type,
        props: flat.props,
        inlineContent: flat.inlineContent,
        plainText: flat.plainText,
        shareStatus: SHARE_STATUS.NOT_SHARED,
      }
    },
  )

  // hard delete blocks that don't exist in the document anymore
  const blocksToDelete = existingBlocks.filter((b) => !incomingBlockIds.has(b.blockNoteId))
  await asyncMap(blocksToDelete, async (block) => {
    const blockShares = await ctx.db
      .query('blockShares')
      .withIndex('by_campaign_block_member', (q) =>
        q.eq('campaignId', campaignId).eq('blockId', block._id),
      )
      .collect()

    await asyncMap(blockShares, (share) => ctx.db.delete('blockShares', share._id))
    await ctx.db.delete('blocks', block._id)
  })

  return persistedBlocks
}
