import { ERROR_CODE, throwClientError } from '../../errors'
import { findBlockByBlockNoteId } from '../../blocks/functions/findBlockByBlockNoteId'
import { insertBlock } from '../../blocks/functions/insertBlock'
import { updateBlock } from '../../blocks/functions/updateBlock'
import { removeBlockIfNotNeeded } from '../../blocks/functions/removeBlockIfNotNeeded'
import { getCurrentSession } from '../../sessions/functions/getCurrentSession'
import { SHARE_STATUS } from '../types'
import type { NoteFromDb } from '../../notes/types'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
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
    noteId: SidebarItemId
    blockId: Id<'blocks'>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<Id<'blockShares'>> {
  const block = await ctx.db.get('blocks', blockId)
  if (!block) throwClientError(ERROR_CODE.NOT_FOUND, 'This content could not be found')
  const campaignId = block.campaignId

  const member = await ctx.db.get('campaignMembers', campaignMemberId)
  if (!member || member.campaignId !== campaignId)
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Member does not belong to this campaign')

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
        updatedBy: ctx.user.profile._id,
      })
    }
    return existingShare._id
  }

  const currentSession = await getCurrentSession(ctx, { campaignId })

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
    createdBy: ctx.user.profile._id,
  })
}

async function removeBlockShare(
  ctx: AuthMutationCtx,
  { blockId, campaignMemberId }: { blockId: Id<'blocks'>; campaignMemberId: Id<'campaignMembers'> },
): Promise<void> {
  const block = await ctx.db.get('blocks', blockId)
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

  if (share && share.deletionTime === null) {
    const now = Date.now()
    await ctx.db.patch('blockShares', share._id, {
      deletionTime: now,
      deletedBy: ctx.user.profile._id,
      updatedTime: now,
      updatedBy: ctx.user.profile._id,
    })
  }
}

async function clearBlockShares(
  ctx: AuthMutationCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<void> {
  const block = await ctx.db.get('blocks', blockId)
  if (!block) return

  const shares = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', blockId),
    )
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()

  const now = Date.now()
  const profileId = ctx.user.profile._id
  await Promise.all(
    shares.map((share) =>
      ctx.db.patch('blockShares', share._id, {
        deletionTime: now,
        deletedBy: profileId,
        updatedTime: now,
        updatedBy: profileId,
      }),
    ),
  )
}

export async function shareBlockWithMemberHelper(
  ctx: AuthMutationCtx,
  {
    note,
    blockItem,
    campaignMemberId,
  }: {
    note: NoteFromDb
    blockItem: BlockItem
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<void> {
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
    note,
    blockNoteId,
    campaignMemberId,
  }: {
    note: NoteFromDb
    blockNoteId: string
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<void> {
  const block = await findBlockByBlockNoteId(ctx, {
    noteId: note._id,
    blockId: blockNoteId,
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

  if (!remainingShares) {
    await ctx.db.patch('blocks', block._id, {
      shareStatus: SHARE_STATUS.NOT_SHARED,
      updatedTime: Date.now(),
      updatedBy: ctx.user.profile._id,
    })
    await removeBlockIfNotNeeded(ctx, { blockId: block._id })
  }
}

export async function setBlockShareStatusHelper(
  ctx: AuthMutationCtx,
  { note, blockItem, status }: { note: NoteFromDb; blockItem: BlockItem; status: ShareStatus },
): Promise<void> {
  const blockId = await upsertBlockForSharing(ctx, {
    note,
    blockItem,
    shareStatus: status,
  })

  if (status === SHARE_STATUS.NOT_SHARED) {
    await clearBlockShares(ctx, { blockId })
    await removeBlockIfNotNeeded(ctx, { blockId })
  }
}
