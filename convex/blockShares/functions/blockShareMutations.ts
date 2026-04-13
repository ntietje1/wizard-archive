import { asyncMap } from 'convex-helpers'
import { ERROR_CODE, throwClientError } from '../../errors'
import { findBlockByBlockNoteId } from '../../blocks/functions/findBlockByBlockNoteId'
import { updateBlock } from '../../blocks/functions/updateBlock'
import { SHARE_STATUS } from '../types'
import type { NoteFromDb } from '../../notes/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { ShareStatus } from '../types'
import type { BlockNoteId } from '../../blocks/types'

async function findBlockOrThrow(
  ctx: CampaignMutationCtx,
  { noteId, blockNoteId }: { noteId: Id<'sidebarItems'>; blockNoteId: BlockNoteId },
): Promise<Id<'blocks'>> {
  const block = await findBlockByBlockNoteId(ctx, { noteId, blockNoteId })
  if (!block) throw throwClientError(ERROR_CODE.NOT_FOUND, 'Block not found')
  return block._id
}

async function addBlockShare(
  ctx: CampaignMutationCtx,
  {
    noteId,
    blockId,
    campaignMemberId,
  }: {
    noteId: Id<'sidebarItems'>
    blockId: Id<'blocks'>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<Id<'blockShares'>> {
  const block = await ctx.db.get('blocks', blockId)
  if (!block) throw throwClientError(ERROR_CODE.NOT_FOUND, 'This content could not be found')
  const campaignId = block.campaignId

  const member = await ctx.db.get('campaignMembers', campaignMemberId)
  if (!member || member.campaignId !== campaignId)
    throw throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Member does not belong to this campaign')

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
    if (existingShare.deletionTime !== null) {
      const now = Date.now()
      await ctx.db.patch('blockShares', existingShare._id, {
        deletionTime: null,
        deletedBy: null,
        updatedTime: now,
        updatedBy: ctx.membership.userId,
      })
    }
    return existingShare._id
  }

  const currentSessionId = ctx.campaign.currentSessionId
  const currentSession = currentSessionId ? await ctx.db.get('sessions', currentSessionId) : null

  return await ctx.db.insert('blockShares', {
    campaignId,
    noteId: noteId,
    blockId,
    campaignMemberId,
    sessionId: currentSession?._id ?? null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: ctx.membership.userId,
  })
}

async function removeBlockShare(
  ctx: CampaignMutationCtx,
  { blockId, campaignMemberId }: { blockId: Id<'blocks'>; campaignMemberId: Id<'campaignMembers'> },
): Promise<void> {
  const block = await ctx.db.get('blocks', blockId)
  if (!block) throw throwClientError(ERROR_CODE.NOT_FOUND, 'Block not found')

  const share = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q
        .eq('campaignId', block.campaignId)
        .eq('blockId', blockId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (share && share.deletionTime === null) {
    const now = Date.now()
    await ctx.db.patch('blockShares', share._id, {
      deletionTime: now,
      deletedBy: ctx.membership.userId,
      updatedTime: now,
      updatedBy: ctx.membership.userId,
    })
  }
}

async function clearBlockShares(
  ctx: CampaignMutationCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<void> {
  const block = await ctx.db.get('blocks', blockId)
  if (!block) throw throwClientError(ERROR_CODE.NOT_FOUND, 'Block not found')

  const shares = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', blockId),
    )
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()

  const now = Date.now()
  const userId = ctx.membership.userId
  await asyncMap(shares, (share) =>
    ctx.db.patch('blockShares', share._id, {
      deletionTime: now,
      deletedBy: userId,
      updatedTime: now,
      updatedBy: userId,
    }),
  )
}

export async function shareBlockWithMemberHelper(
  ctx: CampaignMutationCtx,
  {
    note,
    blockNoteId,
    campaignMemberId,
  }: {
    note: NoteFromDb
    blockNoteId: BlockNoteId
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<void> {
  const blockId = await findBlockOrThrow(ctx, {
    noteId: note._id,
    blockNoteId,
  })

  await updateBlock(ctx, {
    blockDbId: blockId,
    shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
  })

  await addBlockShare(ctx, { noteId: note._id, blockId, campaignMemberId })
}

export async function unshareBlockFromMemberHelper(
  ctx: CampaignMutationCtx,
  {
    note,
    blockNoteId,
    campaignMemberId,
  }: {
    note: NoteFromDb
    blockNoteId: BlockNoteId
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<void> {
  const block = await findBlockByBlockNoteId(ctx, {
    noteId: note._id,
    blockNoteId,
  })
  if (!block) return

  await removeBlockShare(ctx, { blockId: block._id, campaignMemberId })

  const remainingShares = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', block._id),
    )
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .first()

  if (!remainingShares && block.shareStatus !== SHARE_STATUS.ALL_SHARED) {
    await updateBlock(ctx, {
      blockDbId: block._id,
      shareStatus: SHARE_STATUS.NOT_SHARED,
    })
  }
}

export async function setBlockShareStatusHelper(
  ctx: CampaignMutationCtx,
  {
    note,
    blockNoteId,
    status,
  }: { note: NoteFromDb; blockNoteId: BlockNoteId; status: ShareStatus },
): Promise<void> {
  const blockId = await findBlockOrThrow(ctx, {
    noteId: note._id,
    blockNoteId,
  })

  await updateBlock(ctx, {
    blockDbId: blockId,
    shareStatus: status,
  })

  if (status === SHARE_STATUS.NOT_SHARED) {
    await clearBlockShares(ctx, { blockId })
  }
}
