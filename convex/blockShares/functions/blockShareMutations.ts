import { asyncMap } from 'convex-helpers'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { findBlockByBlockNoteId } from '../../blocks/functions/findBlockByBlockNoteId'
import { patchBlockMetadata } from '../../blocks/functions/patchBlockMetadata'
import { SHARE_STATUS } from '../../../shared/editor-blocks/share-status'
import type { NoteFromDb } from '../../notes/types'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { ShareStatus } from '../../../shared/editor-blocks/share-status'
import type { BlockNoteId } from '../../../shared/editor-blocks/types'

export type BlockShareMutationCtx = Pick<MutationCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id' | 'currentSessionId'>
  membership: Pick<Doc<'campaignMembers'>, '_id'>
}

async function findBlockOrThrow(
  ctx: BlockShareMutationCtx,
  { noteId, blockNoteId }: { noteId: Id<'sidebarItems'>; blockNoteId: BlockNoteId },
): Promise<Id<'blocks'>> {
  const block = await findBlockByBlockNoteId(ctx, { noteId, blockNoteId })
  if (!block) throw throwClientError(ERROR_CODE.NOT_FOUND, 'Block not found')
  return block._id
}

async function addBlockShare(
  ctx: BlockShareMutationCtx,
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
  })
}

async function removeBlockShare(
  ctx: BlockShareMutationCtx,
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

  if (share) {
    await ctx.db.delete('blockShares', share._id)
  }
}

async function clearBlockShares(
  ctx: BlockShareMutationCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<void> {
  const block = await ctx.db.get('blocks', blockId)
  if (!block) throw throwClientError(ERROR_CODE.NOT_FOUND, 'Block not found')

  const shares = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', blockId),
    )
    .collect()

  await asyncMap(shares, (share) => ctx.db.delete('blockShares', share._id))
}

export async function shareBlockWithMemberHelper(
  ctx: BlockShareMutationCtx,
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

  await patchBlockMetadata(ctx, {
    blockDbId: blockId,
    shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
  })

  await addBlockShare(ctx, { noteId: note._id, blockId, campaignMemberId })
}

export async function unshareBlockFromMemberHelper(
  ctx: BlockShareMutationCtx,
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

  const remainingShare = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', block._id),
    )
    .first()

  if (!remainingShare && block.shareStatus !== SHARE_STATUS.ALL_SHARED) {
    await patchBlockMetadata(ctx, {
      blockDbId: block._id,
      shareStatus: SHARE_STATUS.NOT_SHARED,
    })
  }
}

export async function setBlockShareStatusHelper(
  ctx: BlockShareMutationCtx,
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

  await patchBlockMetadata(ctx, {
    blockDbId: blockId,
    shareStatus: status,
  })

  if (status === SHARE_STATUS.NOT_SHARED) {
    await clearBlockShares(ctx, { blockId })
  }
}
