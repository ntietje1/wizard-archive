import { asyncMap } from 'convex-helpers'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { findBlockByBlockNoteId } from '../../blocks/functions/findBlockByBlockNoteId'
import { patchBlockMetadata } from '../../blocks/functions/patchBlockMetadata'
import { SHARE_STATUS } from '../../../shared/block-shares/share-status'
import type { NoteItemRow } from '@wizard-archive/editor/notes/item-contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { ShareStatus } from '../../../shared/block-shares/share-status'
import type { NoteBlockId } from '@wizard-archive/editor/notes/document-contract'

export type BlockShareMutationCtx = Pick<MutationCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id' | 'currentSessionId'>
  membership: Pick<Doc<'campaignMembers'>, '_id'>
}

async function findBlockOrThrow(
  ctx: BlockShareMutationCtx,
  { noteId, blockNoteId }: { noteId: Id<'sidebarItems'>; blockNoteId: NoteBlockId },
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
): Promise<boolean> {
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
      return true
    }
    return false
  }

  const currentSessionId = ctx.campaign.currentSessionId
  const currentSession = currentSessionId ? await ctx.db.get('sessions', currentSessionId) : null

  await ctx.db.insert('blockShares', {
    campaignId,
    noteId: noteId,
    blockId: block._id,
    campaignMemberId,
    sessionId: currentSession?._id ?? null,
    permissionLevel,
  })
  return true
}

async function removeBlockShare(
  ctx: BlockShareMutationCtx,
  { block, campaignMemberId }: { block: Doc<'blocks'>; campaignMemberId: Id<'campaignMembers'> },
): Promise<boolean> {
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
    return true
  }
  return false
}

export async function setBlocksMemberPermissionHelper(
  ctx: BlockShareMutationCtx,
  {
    note,
    blockNoteIds,
    campaignMemberId,
    permissionLevel,
  }: {
    note: NoteItemRow
    blockNoteIds: Array<NoteBlockId>
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel: Extract<PermissionLevel, 'none' | 'view'> | null
  },
): Promise<Array<NoteBlockId>> {
  const changes = await asyncMap(blockNoteIds, async (blockNoteId) => ({
    blockNoteId,
    changed: await setBlockMemberPermissionHelper(ctx, {
      note,
      blockNoteId,
      campaignMemberId,
      permissionLevel,
    }),
  }))
  return changes.filter((change) => change.changed).map((change) => change.blockNoteId)
}

export async function setBlockMemberPermissionHelper(
  ctx: BlockShareMutationCtx,
  {
    note,
    blockNoteId,
    campaignMemberId,
    permissionLevel,
  }: {
    note: NoteItemRow
    blockNoteId: NoteBlockId
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel: Extract<PermissionLevel, 'none' | 'view'> | null
  },
): Promise<boolean> {
  if (permissionLevel === null) {
    const block = await findBlockByBlockNoteId(ctx, {
      noteId: note.id,
      blockNoteId,
    })
    if (!block) return false
    const removed = await removeBlockShare(ctx, { block, campaignMemberId })
    const reset = await resetHiddenAllPlayersStatusIfNoOverrides(ctx, block)
    return removed || reset
  }

  const block = await findBlockOrThrow(ctx, {
    noteId: note.id,
    blockNoteId,
  })

  const nextShareStatus = getShareStatusForMemberOverride(
    block.shareStatus ?? SHARE_STATUS.NOT_SHARED,
  )
  const metadataChanged = (block.shareStatus ?? SHARE_STATUS.NOT_SHARED) !== nextShareStatus
  if (metadataChanged) {
    await patchBlockMetadata(ctx, {
      blockDbId: block._id,
      shareStatus: nextShareStatus,
    })
  }

  const shareChanged = await addBlockShare(ctx, {
    noteId: note.id,
    block,
    campaignMemberId,
    permissionLevel,
  })
  return metadataChanged || shareChanged
}

export async function setBlockShareStatusHelper(
  ctx: BlockShareMutationCtx,
  {
    note,
    blockNoteId,
    status,
  }: {
    note: NoteItemRow
    blockNoteId: NoteBlockId
    status: ShareStatus
  },
): Promise<boolean> {
  const block = await findBlockOrThrow(ctx, {
    noteId: note.id,
    blockNoteId,
  })

  if ((block.shareStatus ?? SHARE_STATUS.NOT_SHARED) === status) return false
  await patchBlockMetadata(ctx, { blockDbId: block._id, shareStatus: status })
  return true
}

function getShareStatusForMemberOverride(shareStatus: ShareStatus): ShareStatus {
  return shareStatus === SHARE_STATUS.ALL_SHARED
    ? SHARE_STATUS.ALL_SHARED
    : SHARE_STATUS.INDIVIDUALLY_SHARED
}

async function resetHiddenAllPlayersStatusIfNoOverrides(
  ctx: BlockShareMutationCtx,
  block: Doc<'blocks'>,
): Promise<boolean> {
  if (block.shareStatus === SHARE_STATUS.ALL_SHARED) return false

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
    return block.shareStatus !== SHARE_STATUS.NOT_SHARED
  }
  return false
}
