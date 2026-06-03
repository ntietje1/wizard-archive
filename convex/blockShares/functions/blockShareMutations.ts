import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { findBlockByBlockNoteId } from '../../blocks/functions/findBlockByBlockNoteId'
import { patchBlockMetadata } from '../../blocks/functions/patchBlockMetadata'
import { SHARE_STATUS } from '../../../shared/editor-blocks/share-status'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import type { NoteFromDb } from '../../../shared/notes/types'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { ShareStatus } from '../../../shared/editor-blocks/share-status'
import type { BlockNoteId } from '../../../shared/editor-blocks/types'

export type BlockShareMutationCtx = Pick<MutationCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id' | 'currentSessionId'>
  membership: Pick<Doc<'campaignMembers'>, '_id'>
}

async function findBlockOrThrow(
  ctx: BlockShareMutationCtx,
  { noteId, blockNoteId }: { noteId: Id<'sidebarItems'>; blockNoteId: BlockNoteId },
): Promise<Doc<'blocks'>> {
  const block = await findBlockByBlockNoteId(ctx, { noteId, blockNoteId })
  if (!block) throw throwClientError(ERROR_CODE.NOT_FOUND, 'Block not found')
  return block
}

async function addBlockShare(
  ctx: BlockShareMutationCtx,
  {
    noteId,
    block,
    campaignMemberId,
    permissionLevel,
  }: {
    noteId: Id<'sidebarItems'>
    block: Doc<'blocks'>
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel: Extract<PermissionLevel, 'none' | 'view'>
  },
): Promise<Id<'blockShares'>> {
  const campaignId = block.campaignId

  const member = await ctx.db.get('campaignMembers', campaignMemberId)
  if (!member || member.campaignId !== campaignId)
    throw throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Member does not belong to this campaign')

  const existingShare = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('blockId', block._id)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (existingShare) {
    if (existingShare.permissionLevel !== permissionLevel) {
      await ctx.db.patch('blockShares', existingShare._id, { permissionLevel })
    }
    return existingShare._id
  }

  const currentSessionId = ctx.campaign.currentSessionId
  const currentSession = currentSessionId ? await ctx.db.get('sessions', currentSessionId) : null

  return await ctx.db.insert('blockShares', {
    campaignId,
    noteId: noteId,
    blockId: block._id,
    campaignMemberId,
    sessionId: currentSession?._id ?? null,
    permissionLevel,
  })
}

async function removeBlockShare(
  ctx: BlockShareMutationCtx,
  { block, campaignMemberId }: { block: Doc<'blocks'>; campaignMemberId: Id<'campaignMembers'> },
): Promise<void> {
  const share = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q
        .eq('campaignId', block.campaignId)
        .eq('blockId', block._id)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (share) {
    await ctx.db.delete('blockShares', share._id)
  }
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
  await setBlockMemberPermissionHelper(ctx, {
    note,
    blockNoteId,
    campaignMemberId,
    permissionLevel: PERMISSION_LEVEL.VIEW,
  })
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
  await setBlockMemberPermissionHelper(ctx, {
    note,
    blockNoteId,
    campaignMemberId,
    permissionLevel: null,
  })
}

export async function setBlockMemberPermissionHelper(
  ctx: BlockShareMutationCtx,
  {
    note,
    blockNoteId,
    campaignMemberId,
    permissionLevel,
  }: {
    note: NoteFromDb
    blockNoteId: BlockNoteId
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel: Extract<PermissionLevel, 'none' | 'view'> | null
  },
): Promise<void> {
  if (permissionLevel === null) {
    const block = await findBlockByBlockNoteId(ctx, {
      noteId: note._id,
      blockNoteId,
    })
    if (!block) return
    await removeBlockShare(ctx, { block, campaignMemberId })
    await resetHiddenAllPlayersStatusIfNoOverrides(ctx, block)
    return
  }

  const block = await findBlockOrThrow(ctx, {
    noteId: note._id,
    blockNoteId,
  })

  await patchBlockMetadata(ctx, {
    blockDbId: block._id,
    shareStatus: getShareStatusForMemberOverride(block.shareStatus ?? SHARE_STATUS.NOT_SHARED),
  })

  await addBlockShare(ctx, {
    noteId: note._id,
    block,
    campaignMemberId,
    permissionLevel,
  })
}

export async function setBlockShareStatusHelper(
  ctx: BlockShareMutationCtx,
  {
    note,
    blockNoteId,
    status,
  }: { note: NoteFromDb; blockNoteId: BlockNoteId; status: ShareStatus },
): Promise<void> {
  const block = await findBlockOrThrow(ctx, {
    noteId: note._id,
    blockNoteId,
  })

  await patchBlockMetadata(ctx, {
    blockDbId: block._id,
    shareStatus: status,
  })
}

function getShareStatusForMemberOverride(shareStatus: ShareStatus): ShareStatus {
  return shareStatus === SHARE_STATUS.ALL_SHARED
    ? SHARE_STATUS.ALL_SHARED
    : SHARE_STATUS.INDIVIDUALLY_SHARED
}

async function resetHiddenAllPlayersStatusIfNoOverrides(
  ctx: BlockShareMutationCtx,
  block: Doc<'blocks'>,
) {
  if (block.shareStatus === SHARE_STATUS.ALL_SHARED) return

  const remainingShare = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', block._id),
    )
    .first()

  if (!remainingShare) {
    await patchBlockMetadata(ctx, {
      blockDbId: block._id,
      shareStatus: SHARE_STATUS.NOT_SHARED,
    })
  }
}
