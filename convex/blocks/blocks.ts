import { SHARE_STATUS } from '../shares/types'
import type { Block } from './types'
import type { ShareStatus } from '../shares/types'
import type { Id } from '../_generated/dataModel'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'
import type { CustomBlock } from '../notes/editorSpecs'

export const findBlockByBlockNoteId = async (
  ctx: CampaignQueryCtx,
  { noteId, blockId }: { noteId: Id<'notes'>; blockId: string },
): Promise<Block | null> => {
  const note = await ctx.db.get(noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  const block = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q
        .eq('campaignId', note.campaignId)
        .eq('noteId', noteId)
        .eq('blockId', blockId),
    )
    .unique()

  return block
}

export async function getTopLevelBlocksByNote(
  ctx: CampaignQueryCtx,
  { noteId }: { noteId: Id<'notes'> },
): Promise<Array<Block>> {
  const campaignId = ctx.campaign._id

  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_topLevel', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('noteId', noteId)
        .eq('isTopLevel', true),
    )
    .collect()

  return blocks.sort((a, b) => (a.position || 0) - (b.position || 0))
}

export async function deleteBlocksByNote(
  ctx: CampaignMutationCtx,
  { noteId }: { noteId: Id<'notes'> },
): Promise<void> {
  const campaignId = ctx.campaign._id

  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', campaignId).eq('noteId', noteId),
    )
    .collect()

  for (const block of blocks) {
    await ctx.db.delete(block._id)
  }
}

export async function saveTopLevelBlocksForNote(
  ctx: CampaignMutationCtx,
  { noteId, content }: { noteId: Id<'notes'>; content: Array<CustomBlock> },
): Promise<void> {
  const campaignId = ctx.campaign._id
  const now = Date.now()

  const existingTopLevelBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_topLevel', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('noteId', noteId)
        .eq('isTopLevel', true),
    )
    .collect()

  const existingBlocksMap = new Map(
    existingTopLevelBlocks.map((block) => [block.blockId, block]),
  )

  const positions = new Map<string, number>()
  content.forEach((block, index) => positions.set(block.id, index))

  for (const block of content) {
    const existingBlock = existingBlocksMap.get(block.id)
    if (existingBlock) {
      await updateBlock(ctx, {
        blockDbId: existingBlock._id,
        updates: {
          position: positions.get(block.id),
          content: block,
          isTopLevel: existingBlock.isTopLevel,
          updatedAt: now,
        },
      })
    } else {
      await insertBlock(ctx, {
        noteId,
        campaignId,
        blockId: block.id,
        isTopLevel: true,
        position: positions.get(block.id),
        content: block,
        now,
        shareStatus: SHARE_STATUS.NOT_SHARED,
      })
    }
  }
  const remainingBlocks = existingTopLevelBlocks.filter(
    (b) => !content.some((b2) => b2.id === b.blockId),
  )
  for (const block of remainingBlocks) {
    await removeBlockIfNotNeeded(ctx, { blockId: block._id })
  }
}

export async function insertBlock(
  ctx: CampaignMutationCtx,
  params: {
    noteId: Id<'notes'>
    campaignId: Id<'campaigns'>
    blockId: string
    isTopLevel: boolean
    position?: number
    content: CustomBlock
    now: number
    shareStatus: ShareStatus
  },
): Promise<Id<'blocks'>> {
  return await ctx.db.insert('blocks', {
    noteId: params.noteId,
    campaignId: params.campaignId,
    blockId: params.blockId,
    position: params.position,
    content: params.content,
    isTopLevel: params.isTopLevel,
    updatedAt: params.now,
    shareStatus: params.shareStatus ?? SHARE_STATUS.NOT_SHARED,
  })
}

export async function updateBlock(
  ctx: CampaignMutationCtx,
  {
    blockDbId,
    updates,
  }: {
    blockDbId: Id<'blocks'>
    updates: {
      position?: number
      content?: CustomBlock
      isTopLevel?: boolean
      shareStatus?: ShareStatus
      updatedAt?: number
    }
  },
): Promise<void> {
  await ctx.db.patch(blockDbId, updates)
}

/**
 * Removes a block if:
 * - It is not shared
 * - It is not a top-level block
 */
export async function removeBlockIfNotNeeded(
  ctx: CampaignMutationCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<void> {
  const campaignId = ctx.campaign._id

  const block = await ctx.db.get(blockId)
  if (
    !block ||
    block.campaignId !== campaignId ||
    block.isTopLevel ||
    block.shareStatus !== SHARE_STATUS.NOT_SHARED
  ) {
    return
  }
  await ctx.db.delete(blockId)
}
