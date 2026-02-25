import { findBlockByBlockNoteId } from '../../blocks/functions/findBlockByBlockNoteId'
import { insertBlock } from '../../blocks/functions/insertBlock'
import { updateBlock } from '../../blocks/functions/updateBlock'
import { removeBlockIfNotNeeded } from '../../blocks/functions/removeBlockIfNotNeeded'
import { getCurrentSession } from '../../sessions/functions/getCurrentSession'
import { SHARE_STATUS } from '../types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { BlockItem, ShareStatus } from '../types'

async function upsertBlockForSharing(
  ctx: CampaignMutationCtx,
  {
    noteId,
    blockItem,
    shareStatus,
  }: {
    noteId: Id<'notes'>
    blockItem: BlockItem
    shareStatus: ShareStatus
  },
): Promise<Id<'blocks'>> {
  const campaignId = ctx.campaign._id

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
    campaignId,
    blockId: blockItem.blockNoteId,
    content: blockItem.content,
    isTopLevel: true,
    noteId,
    shareStatus,
    position: null,
  })
}

async function addBlockShare(
  ctx: CampaignMutationCtx,
  {
    blockId,
    campaignMemberId,
  }: { blockId: Id<'blocks'>; campaignMemberId: Id<'campaignMembers'> },
): Promise<Id<'blockShares'>> {
  const campaignId = ctx.campaign._id

  const block = await ctx.db.get(blockId)
  if (!block || block.campaignId !== campaignId) {
    throw new Error('Block not found')
  }

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

  const currentSession = await getCurrentSession(ctx)
  const now = Date.now()

  return await ctx.db.insert('blockShares', {
    campaignId,
    blockId,
    campaignMemberId,
    sessionId: currentSession?._id,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
    createdBy: ctx.user.profile._id,
  })
}

async function removeBlockShare(
  ctx: CampaignMutationCtx,
  {
    blockId,
    campaignMemberId,
  }: { blockId: Id<'blocks'>; campaignMemberId: Id<'campaignMembers'> },
): Promise<void> {
  const campaignId = ctx.campaign._id

  const share = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('blockId', blockId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (share) {
    await ctx.db.delete(share._id)
  }
}

async function clearBlockShares(
  ctx: CampaignMutationCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<void> {
  const campaignId = ctx.campaign._id

  const shares = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', campaignId).eq('blockId', blockId),
    )
    .collect()

  for (const share of shares) {
    await ctx.db.delete(share._id)
  }
}

export async function shareBlockWithMemberHelper(
  ctx: CampaignMutationCtx,
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
  const blockId = await upsertBlockForSharing(ctx, {
    noteId,
    blockItem,
    shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
  })

  await addBlockShare(ctx, { blockId, campaignMemberId })
}

export async function unshareBlockFromMemberHelper(
  ctx: CampaignMutationCtx,
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
  const campaignId = ctx.campaign._id

  const block = await findBlockByBlockNoteId(ctx, {
    noteId,
    blockId: blockNoteId,
  })
  if (!block || block.campaignId !== campaignId) return

  await removeBlockShare(ctx, { blockId: block._id, campaignMemberId })

  // Check if any shares remain
  const remainingShares = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', campaignId).eq('blockId', block._id),
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
  ctx: CampaignMutationCtx,
  {
    noteId,
    blockItem,
    status,
  }: { noteId: Id<'notes'>; blockItem: BlockItem; status: ShareStatus },
): Promise<void> {
  const blockId = await upsertBlockForSharing(ctx, {
    noteId,
    blockItem,
    shareStatus: status,
  })

  // If setting to not_shared, clear any individual shares
  if (status === SHARE_STATUS.NOT_SHARED) {
    await clearBlockShares(ctx, { blockId })
    await removeBlockIfNotNeeded(ctx, { blockId })
  }
}
