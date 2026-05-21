import { asyncMap } from 'convex-helpers'
import { ERROR_CODE, throwClientError } from '../../errors'
import { SHARE_STATUS } from '../../../shared/editor-blocks/share-status'
import { flattenBlocks } from './flattenBlocks'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { CustomBlock } from '../../../shared/editor-blocks/types'
import type { Block, BlockInsert, PersistedFlatBlock } from '../types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { isActiveSidebarItem } from '../../sidebarItems/types/status'

export async function saveAllBlocksForNote(
  ctx: Pick<MutationCtx, 'db'>,
  { noteId, content }: { noteId: Id<'sidebarItems'>; content: Array<CustomBlock> },
): Promise<Array<Block>> {
  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (note.type !== SIDEBAR_ITEM_TYPES.notes) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Block projection requires a note item')
  }
  if (!isActiveSidebarItem(note)) return []
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
  await asyncMap(flatBlocks, async (flat): Promise<void> => {
    const existing = existingBlocksMap.get(flat.blockNoteId)
    if (existing) {
      await replacePersistedBlock(ctx, existing._id, flat)
      return
    }

    await insertPersistedBlock(ctx, {
      ...flat,
      noteId,
      campaignId,
      shareStatus: SHARE_STATUS.NOT_SHARED,
    })
  })

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

  const finalBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) => q.eq('campaignId', campaignId).eq('noteId', noteId))
    .collect()
  const finalBlocksMap = new Map(finalBlocks.map((block) => [block.blockNoteId, block]))

  return flatBlocks.map((flat) => {
    const block = finalBlocksMap.get(flat.blockNoteId)
    if (!block) {
      // Invariant: every incoming flat block has just been inserted or updated above.
      throw new Error(`Block ${flat.blockNoteId} missing after saveAllBlocksForNote`)
    }
    return block
  })
}

async function insertPersistedBlock(
  ctx: Pick<MutationCtx, 'db'>,
  params: BlockInsert,
): Promise<Id<'blocks'>> {
  validatePersistedBlockDepth(params)
  return await ctx.db.insert('blocks', params)
}

async function replacePersistedBlock(
  ctx: Pick<MutationCtx, 'db'>,
  blockDbId: Id<'blocks'>,
  block: PersistedFlatBlock,
): Promise<void> {
  validatePersistedBlockDepth(block)
  await ctx.db.patch('blocks', blockDbId, {
    parentBlockId: block.parentBlockId,
    depth: block.depth,
    position: block.position,
    type: block.type,
    props: block.props,
    content: block.content,
    inlineContent: block.inlineContent,
    plainText: block.plainText,
  })
}

function validatePersistedBlockDepth(block: Pick<PersistedFlatBlock, 'depth' | 'parentBlockId'>) {
  if (block.depth < 0) throwClientError(ERROR_CODE.VALIDATION_FAILED, 'depth must be non-negative')
  if (block.parentBlockId === null && block.depth !== 0) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'depth must be 0 when parentBlockId is null')
  }
  if (block.parentBlockId !== null && block.depth === 0) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'depth must be > 0 when parentBlockId is set')
  }
}
