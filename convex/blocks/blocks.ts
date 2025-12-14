import { Id } from '../_generated/dataModel'
import { MutationCtx } from '../_generated/server'
import { Ctx } from '../common/types'
import { CustomBlock } from '../notes/editorSpecs'
import { getNote } from '../notes/notes'
import type { Note } from '../notes/types'
import type { Block } from './types'
import {
  extractAllBlocksWithTags,
  computeTopLevelPositions,
  upsertBlock,
  updateBlockTags,
  insertInlineBlockTags,
  cleanupUnprocessedBlocks,
} from '../tags/tags'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import { Tag } from '../tags/types'

export const findBlockByBlockNoteId = async (
  ctx: Ctx,
  noteId: Id<'notes'>,
  blockId: string,
): Promise<Block | null> => {
  const note: Note | null = await getNote(ctx, noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  // Use the full index to efficiently find the block
  const block = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q
        .eq('campaignId', note.campaignId)
        .eq('noteId', noteId)
        .eq('blockId', blockId),
    )
    .unique()

  return block || null
}

export async function getBlocksByNote(
  ctx: Ctx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>,
): Promise<Block[]> {
  return await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', campaignId).eq('noteId', noteId),
    )
    .collect()
}

export async function getTopLevelBlocksByNote(
  ctx: Ctx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>,
): Promise<Block[]> {
  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', campaignId).eq('noteId', noteId),
    )
    .collect()

  return blocks
    .filter((block) => block.isTopLevel)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
}

export async function getTopLevelBlocksByChildNote(
  ctx: Ctx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>,
): Promise<Block[]> {
  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', campaignId).eq('noteId', noteId),
    )
    .collect()

  return blocks
    .filter((block) => block.isTopLevel)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
}

export async function getBlocksByCampaign(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
): Promise<Block[]> {
  return await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) => q.eq('campaignId', campaignId))
    .collect()
}

async function deleteBlockAndTags(
  ctx: MutationCtx,
  blockId: Id<'blocks'>,
  campaignId: Id<'campaigns'>,
): Promise<void> {
  const blockTags = await ctx.db
    .query('blockTags')
    .withIndex('by_campaign_block_tag', (q) =>
      q.eq('campaignId', campaignId).eq('blockId', blockId),
    )
    .collect()

  for (const blockTag of blockTags) {
    await ctx.db.delete(blockTag._id)
  }
  await ctx.db.delete(blockId)
}

export async function deleteBlocksByNote(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>,
): Promise<void> {
  const blocks = await getBlocksByNote(ctx, noteId, campaignId)

  for (const block of blocks) {
    await deleteBlockAndTags(ctx, block._id, campaignId)
  }
}

export async function saveTopLevelBlocksForChildNote(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
  content: CustomBlock[],
) {
  const now = Date.now()

  const note = await ctx.db.get(noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  // Check if note's parentId is a tag
  const parentItem = note.parentId
    ? await getSidebarItemById(ctx, note.campaignId, note.parentId)
    : null
  const noteLevelTag =
    parentItem?.type === SIDEBAR_ITEM_TYPES.tags ? (parentItem as Tag) : null

  const allBlocksWithTags = extractAllBlocksWithTags(
    content,
    noteLevelTag?._id || null,
  )

  const existingBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', note.campaignId).eq('noteId', noteId),
    )
    .collect()

  const existingBlocksMap = new Map(
    existingBlocks.map((block) => [block.blockId, block]),
  )

  const processedBlockIds = new Set<string>()
  const positions = computeTopLevelPositions(allBlocksWithTags)

  for (const [
    blockId,
    { block, tagIds: inlineTagIds, isTopLevel },
  ] of allBlocksWithTags) {
    processedBlockIds.add(blockId)
    const existingBlock = existingBlocksMap.get(blockId)

    const finalBlockDbId = await upsertBlock(ctx, existingBlock, {
      noteId,
      campaignId: note.campaignId,
      blockId,
      isTopLevel,
      position: isTopLevel ? positions.get(blockId) : undefined,
      content: block,
      now,
    })

    if (existingBlock) {
      await updateBlockTags(
        ctx,
        note.campaignId,
        finalBlockDbId,
        existingBlock.content,
        inlineTagIds,
      )
    } else {
      await insertInlineBlockTags(
        ctx,
        note.campaignId,
        finalBlockDbId,
        inlineTagIds,
      )
    }
  }

  await cleanupUnprocessedBlocks(
    ctx,
    existingBlocks,
    processedBlockIds,
    content,
    now,
  )
}
