import { getNote } from '../notes/notes'
import { enforceBlockSharePermissionsOrNull } from '../shares/blockShares'
import { requireEditPermission } from '../shares/itemShares'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { SHARE_STATUS } from '../shares/types'
import type { Block } from './types'
import type { ShareStatus } from '../shares/types'
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
  viewAsPlayerId?: Id<'campaignMembers'>,
): Promise<Array<Block>> {
  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', campaignId).eq('noteId', noteId),
    )
    .collect()

  const topLevelBlocks = blocks.filter((block) => block.isTopLevel)

  const permittedBlocks = await Promise.all(
    topLevelBlocks.map((block) =>
      enforceBlockSharePermissionsOrNull(ctx, block, viewAsPlayerId),
    ),
  )

  return permittedBlocks
    .filter((block): block is Block => block !== null)
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

export async function deleteBlocksByNote(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>,
): Promise<void> {
  const blocks = await getBlocksByNote(ctx, noteId, campaignId)

  for (const block of blocks) {
    await ctx.db.delete(block._id)
  }
}

export async function saveTopLevelBlocksForNote(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
  content: Array<CustomBlock>,
) {
  const now = Date.now()

  const rawNote = await ctx.db.get(noteId)
  if (!rawNote) {
    throw new Error('Note not found')
  }

  const note = await enhanceSidebarItem(ctx, rawNote)
  await requireEditPermission(ctx, note)

  const existingTopLevelBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', note.campaignId).eq('noteId', noteId),
    )
    .collect()
    .then((blocks) => blocks.filter((block) => block.isTopLevel))

  const existingBlocksMap = new Map(
    existingTopLevelBlocks.map((block) => [block.blockId, block]),
  )

  const positions = new Map<string, number>()
  content.forEach((block, index) => positions.set(block.id, index))

  for (const block of content) {
    const existingBlock = existingBlocksMap.get(block.id)
    if (existingBlock) {
      await updateBlock(ctx, existingBlock._id, {
        position: positions.get(block.id),
        content: block,
        isTopLevel: existingBlock.isTopLevel,
        updatedAt: now,
      })
    } else {
      await insertBlock(ctx, {
        noteId,
        campaignId: note.campaignId,
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
    await removeBlockIfNotNeeded(ctx, note.campaignId, block._id)
  }
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
  ctx: MutationCtx,
  blockDbId: Id<'blocks'>,
  updates: {
    position?: number
    content?: CustomBlock
    isTopLevel?: boolean
    shareStatus?: ShareStatus
    updatedAt?: number
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
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  blockId: Id<'blocks'>,
): Promise<void> {
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
