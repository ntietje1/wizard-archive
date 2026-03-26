import { findBlockByBlockNoteId } from '../../blocks/functions/findBlockByBlockNoteId'
import { insertBlock } from '../../blocks/functions/insertBlock'
import { updateBlock } from '../../blocks/functions/updateBlock'
import { removeBlockIfNotNeeded } from '../../blocks/functions/removeBlockIfNotNeeded'
import { getCurrentSession } from '../../sessions/functions/getCurrentSession'
import { SHARE_STATUS } from '../types'
import { requireDmRole } from '../../functions'
import type { NoteFromDb } from '../../notes/types'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { BlockItem, ShareStatus } from '../types'

async function upsertBlockForSharing(
  ctx: AuthMutationCtx,
  {
    note,
    blockItem,
    shareStatus,
  }: {
    note: NoteFromDb
    blockItem: BlockItem
    shareStatus: ShareStatus
  },
): Promise<Id<'blocks'>> {
  const noteId = note._id

  const existingBlock = await findBlockByBlockNoteId(ctx, {
    noteId,
    blockId: blockItem.blockNoteId,
  })

  if (existingBlock) {
    await updateBlock(ctx, {
      blockDbId: existingBlock._id,
      content: blockItem.content,
      isTopLevel: true,
      shareStatus,
    })
    return existingBlock._id
  }

  return await insertBlock(ctx, {
    campaignId: note.campaignId,
    blockId: blockItem.blockNoteId,
    content: blockItem.content,
    isTopLevel: true,
    noteId,
    shareStatus,
    position: null,
  })
}

async function addBlockShare(
  ctx: AuthMutationCtx,
  {
    noteId,
    blockId,
    campaignMemberId,
  }: {
    noteId: Id<'notes'>
    blockId: Id<'blocks'>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<Id<'blockShares'>> {
  const block = await ctx.db.get(blockId)
  if (!block) throw new Error('Block not found')
  const campaignId = block.campaignId

  const existingShare = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('blockId', blockId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (existingShare) {
    return existingShare._id
  }

  const currentSession = await getCurrentSession(ctx, { campaignId })

  return await ctx.db.insert('blockShares', {
    campaignId,
    noteId,
    blockId,
    campaignMemberId,
    sessionId: currentSession?._id ?? null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: ctx.user.profile._id,
  })
}

async function removeBlockShare(
  ctx: AuthMutationCtx,
  {
    blockId,
    campaignMemberId,
  }: { blockId: Id<'blocks'>; campaignMemberId: Id<'campaignMembers'> },
): Promise<void> {
  const block = await ctx.db.get(blockId)
  if (!block) return

  const share = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q
        .eq('campaignId', block.campaignId)
        .eq('blockId', blockId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (share) {
    await ctx.db.delete(share._id)
  }
}

async function clearBlockShares(
  ctx: AuthMutationCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<void> {
  const block = await ctx.db.get(blockId)
  if (!block) return

  const shares = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', blockId),
    )
    .collect()

  for (const share of shares) {
    await ctx.db.delete(share._id)
  }
}

export async function shareBlockWithMemberHelper(
  ctx: AuthMutationCtx,
  {
    noteId,
    blockItem,
    campaignMemberId,
  }: {
    noteId: Id<'notes'>
    blockItem: BlockItem
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<void> {
  const note = await ctx.db.get(noteId)
  if (!note) throw new Error('Note not found')
  await requireDmRole(ctx, note.campaignId)

  const blockId = await upsertBlockForSharing(ctx, {
    note,
    blockItem,
    shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
  })

  await addBlockShare(ctx, { noteId: note._id, blockId, campaignMemberId })
}

export async function unshareBlockFromMemberHelper(
  ctx: AuthMutationCtx,
  {
    noteId,
    blockNoteId,
    campaignMemberId,
  }: {
    noteId: Id<'notes'>
    blockNoteId: string
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<void> {
  const note = await ctx.db.get(noteId)
  if (!note) throw new Error('Note not found')
  await requireDmRole(ctx, note.campaignId)

  const block = await findBlockByBlockNoteId(ctx, {
    noteId,
    blockId: blockNoteId,
  })
  if (!block) return

  await removeBlockShare(ctx, { blockId: block._id, campaignMemberId })

  // Check if any shares remain
  const remainingShares = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', block._id),
    )
    .first()

  // If no shares remain, set status to not_shared
  if (!remainingShares) {
    await ctx.db.patch(block._id, {
      shareStatus: SHARE_STATUS.NOT_SHARED,
      updatedTime: Date.now(),
      updatedBy: ctx.user.profile._id,
    })
    await removeBlockIfNotNeeded(ctx, { blockId: block._id })
  }
}

export async function setBlockShareStatusHelper(
  ctx: AuthMutationCtx,
  {
    noteId,
    blockItem,
    status,
  }: { noteId: Id<'notes'>; blockItem: BlockItem; status: ShareStatus },
): Promise<void> {
  const note = await ctx.db.get(noteId)
  if (!note) throw new Error('Note not found')
  await requireDmRole(ctx, note.campaignId)

  const blockId = await upsertBlockForSharing(ctx, {
    note,
    blockItem,
    shareStatus: status,
  })

  // If setting to not_shared, clear any individual shares
  if (status === SHARE_STATUS.NOT_SHARED) {
    await clearBlockShares(ctx, { blockId })
    await removeBlockIfNotNeeded(ctx, { blockId })
  }
}
