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

export const findBlockByBlockNoteId = async (
  ctx: Ctx,
  noteId: Id<'notes'>,
  pageId: Id<'pages'>,
  blockId: string,
): Promise<Block | null> => {
  const note: Note | null = await getNote(ctx, noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  // Use the full index to efficiently find the block
  const block = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_page_block', (q) =>
      q
        .eq('campaignId', note.campaignId)
        .eq('noteId', noteId)
        .eq('pageId', pageId)
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
    .withIndex('by_campaign_note_page_block', (q) =>
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
    .withIndex('by_campaign_note_page_block', (q) =>
      q.eq('campaignId', campaignId).eq('noteId', noteId),
    )
    .collect()

  return blocks
    .filter((block) => block.isTopLevel)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
}

export async function getTopLevelBlocksByPage(
  ctx: Ctx,
  pageId: Id<'pages'>,
  campaignId: Id<'campaigns'>,
): Promise<Block[]> {
  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_page', (q) => q.eq('pageId', pageId))
    .collect()

  return blocks
    .filter((block) => block.isTopLevel && block.campaignId === campaignId)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
}

export async function getBlocksByCampaign(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
): Promise<Block[]> {
  return await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_page_block', (q) =>
      q.eq('campaignId', campaignId),
    )
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

export async function saveTopLevelBlocksForPage(
  ctx: MutationCtx,
  pageId: Id<'pages'>,
  content: CustomBlock[],
) {
  const now = Date.now()

  const page = await ctx.db.get(pageId)
  if (!page) {
    throw new Error('Page not found')
  }

  const note = await ctx.db.get(page.noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  const noteLevelTag = note.tagId ? await ctx.db.get(note.tagId) : null

  const allBlocksWithTags = extractAllBlocksWithTags(
    content,
    noteLevelTag?._id || null,
  )

  const existingBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_page', (q) => q.eq('pageId', pageId))
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
      noteId: page.noteId,
      pageId: pageId,
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
