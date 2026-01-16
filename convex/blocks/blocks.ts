import { getNote } from '../notes/notes'
import {
  cleanupUnprocessedBlocks,
  computeTopLevelPositions,
  extractAllBlocksWithMentions,
  getBlockMentions,
  insertBlockMentions,
  updateBlockMentions,
} from '../mentions/mentions'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { BLOCK_SHARE_STATUS } from './types'
import type { Block, BlockShareStatus } from './types'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { Ctx } from '../common/types'
import type { CustomBlock } from '../notes/editorSpecs'
import type { Note } from '../notes/types'

export const findBlockByBlockNoteId = async (
  ctx: Ctx,
  noteId: Id<'notes'>,
  blockId: string,
): Promise<Block | null> => {
  const note: Note | null = await getNote(ctx, noteId)
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

  return block || null
}

export async function getBlocksByNote(
  ctx: Ctx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>,
): Promise<Array<Block>> {
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
): Promise<Array<Block>> {
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

export async function getSharedBlocksByNoteAndPlayer(
  ctx: Ctx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>,
  sharedWithPlayerId?: Id<'campaignMembers'>,
): Promise<Array<Block>> {
  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )
  const targetPlayerId = sharedWithPlayerId ?? campaignWithMembership.member._id
  if (
    targetPlayerId !== campaignWithMembership.member._id &&
    campaignWithMembership.member.role !== CAMPAIGN_MEMBER_ROLE.DM
  ) {
    throw new Error('You are not allowed to access this content')
  }

  const allSharedBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_shareStatus', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('noteId', noteId)
        .eq('shareStatus', BLOCK_SHARE_STATUS.ALL_SHARED),
    )
    .collect()

  const individuallySharedBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_shareStatus', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('noteId', noteId)
        .eq('shareStatus', BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED),
    )
    .collect()

  for (const block of individuallySharedBlocks) {
    const share = await ctx.db
      .query('blockShares')
      .withIndex('by_campaign_block_member', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('blockId', block._id)
          .eq('campaignMemberId', targetPlayerId),
      )
      .unique()
    if (share) {
      allSharedBlocks.push(block)
    }
  }

  return allSharedBlocks
    .filter((block) => block.isTopLevel)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
}

export async function getBlocksByCampaign(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
): Promise<Array<Block>> {
  return await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) => q.eq('campaignId', campaignId))
    .collect()
}

async function deleteBlockAndMentions(
  ctx: MutationCtx,
  blockId: Id<'blocks'>,
  campaignId: Id<'campaigns'>,
): Promise<void> {
  const blockMentions = await ctx.db
    .query('blockMentions')
    .withIndex('by_campaign_block_item', (q) =>
      q.eq('campaignId', campaignId).eq('blockId', blockId),
    )
    .collect()

  for (const blockMention of blockMentions) {
    await ctx.db.delete(blockMention._id)
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
    await deleteBlockAndMentions(ctx, block._id, campaignId)
  }
}

export async function saveTopLevelBlocksForNote(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
  content: Array<CustomBlock>,
) {
  const now = Date.now()

  const note = await ctx.db.get(noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const allBlocksWithMentions = extractAllBlocksWithMentions(content)

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
  const positions = computeTopLevelPositions(allBlocksWithMentions)

  for (const [
    blockId,
    { block, mentions, isTopLevel },
  ] of allBlocksWithMentions) {
    processedBlockIds.add(blockId)
    const existingBlock = existingBlocksMap.get(blockId)

    let finalBlockDbId: Id<'blocks'>
    if (existingBlock) {
      // Preserve isTopLevel for shared blocks to prevent accidental demotion
      const isSharedTopLevel =
        existingBlock.shareStatus !== BLOCK_SHARE_STATUS.NOT_SHARED &&
        existingBlock.isTopLevel
      const finalIsTopLevel = isSharedTopLevel || isTopLevel
      const position = finalIsTopLevel
        ? (positions.get(blockId) ?? existingBlock.position)
        : undefined

      await updateBlock(ctx, existingBlock._id, {
        position,
        content: block,
        isTopLevel: finalIsTopLevel,
        updatedAt: now,
      })
      finalBlockDbId = existingBlock._id
      await updateBlockMentions(
        ctx,
        note.campaignId,
        finalBlockDbId,
        existingBlock.content,
        mentions,
      )
    } else {
      finalBlockDbId = await insertBlock(ctx, {
        noteId,
        campaignId: note.campaignId,
        blockId,
        isTopLevel,
        position: isTopLevel ? positions.get(blockId) : undefined,
        content: block,
        now,
        shareStatus: BLOCK_SHARE_STATUS.NOT_SHARED,
      })
      await insertBlockMentions(ctx, note.campaignId, finalBlockDbId, mentions)
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

export async function insertBlock(
  ctx: MutationCtx,
  params: {
    noteId: Id<'notes'>
    campaignId: Id<'campaigns'>
    blockId: string
    isTopLevel: boolean
    position?: number
    content: CustomBlock
    now: number
    shareStatus: BlockShareStatus
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
    shareStatus: params.shareStatus ?? BLOCK_SHARE_STATUS.NOT_SHARED,
  })
}

export async function updateBlock(
  ctx: MutationCtx,
  blockDbId: Id<'blocks'>,
  updates: {
    position?: number
    content?: CustomBlock
    isTopLevel?: boolean
    shareStatus?: BlockShareStatus
    updatedAt?: number
  },
): Promise<void> {
  await ctx.db.patch(blockDbId, updates)
}

/**
 * Removes a block if:
 * - It has no mentions
 * - It is not shared
 * - It is not a top-level block
 */
export async function removeBlockIfNotNeeded(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  blockId: Id<'blocks'>,
): Promise<void> {
  const block = await ctx.db.get(blockId)
  if (
    !block ||
    block.campaignId !== campaignId ||
    block.isTopLevel ||
    block.shareStatus !== BLOCK_SHARE_STATUS.NOT_SHARED
  ) {
    return
  }
  const currentMentions = await getBlockMentions(ctx, campaignId, blockId)
  if (currentMentions.length > 0) {
    return
  }
  await ctx.db.delete(blockId)
}
