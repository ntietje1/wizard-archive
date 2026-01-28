import {
  getCampaignMembership,
  requireCampaignMembership,
} from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getCurrentSession } from '../sessions/sessions'
import {
  findBlockByBlockNoteId,
  insertBlock,
  removeBlockIfNotNeeded,
  updateBlock,
} from '../blocks/blocks'
import { PERMISSION_STATUS, SHARE_STATUS } from './types'
import type { Ctx } from '../common/types'
import type { BlockItem } from './itemShares'
import type { Block } from '../blocks/types'
import type { BlockShare, PermissionStatus, ShareStatus } from './types'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

export async function getBlockPermissionStatus(
  ctx: Ctx,
  block: Block,
  viewAsPlayerId?: Id<'campaignMembers'>,
): Promise<PermissionStatus> {
  const { campaignWithMembership } = await getCampaignMembership(ctx, {
    campaignId: block.campaignId,
  })

  if (!campaignWithMembership) {
    return PERMISSION_STATUS.NO_ACCESS
  }

  let checkId = campaignWithMembership.member._id

  // DMs can choose to view as a specific player
  if (campaignWithMembership.member.role === CAMPAIGN_MEMBER_ROLE.DM) {
    if (!viewAsPlayerId) {
      return PERMISSION_STATUS.EDIT // DMs see all blocks
    } else {
      checkId = viewAsPlayerId // Check permissions for specific player
    }
  }

  const shareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED

  switch (shareStatus) {
    case SHARE_STATUS.ALL_SHARED:
      return PERMISSION_STATUS.VIEW
    case SHARE_STATUS.INDIVIDUALLY_SHARED: {
      const isShared = await isBlockSharedWithMember(
        ctx,
        block.campaignId,
        block._id,
        checkId,
      )
      return isShared ? PERMISSION_STATUS.VIEW : PERMISSION_STATUS.NO_ACCESS
    }
    case SHARE_STATUS.NOT_SHARED:
      return PERMISSION_STATUS.NO_ACCESS
  }
}

export async function enforceBlockSharePermissionsOrNull(
  ctx: Ctx,
  block: Block,
  viewAsPlayerId?: Id<'campaignMembers'>,
): Promise<Block | null> {
  const permissionStatus = await getBlockPermissionStatus(
    ctx,
    block,
    viewAsPlayerId,
  )
  if (permissionStatus === PERMISSION_STATUS.NO_ACCESS) {
    return null
  }

  return block
}

export async function setBlockShareStatusHelper(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  noteId: Id<'notes'>,
  blockItem: BlockItem,
  status: ShareStatus,
): Promise<void> {
  const existingBlock = await findBlockByBlockNoteId(
    ctx,
    noteId,
    blockItem.blockNoteId,
  )

  let blockId: Id<'blocks'>
  if (existingBlock) {
    await updateBlock(ctx, existingBlock._id, {
      content: blockItem.content,
      shareStatus: status,
      isTopLevel: true,
      updatedAt: Date.now(),
    })
    blockId = existingBlock._id
  } else {
    blockId = await insertBlock(ctx, {
      campaignId,
      blockId: blockItem.blockNoteId,
      content: blockItem.content,
      shareStatus: status,
      isTopLevel: true,
      noteId,
      now: Date.now(),
    })
  }

  // If setting to not_shared, clear any individual shares
  if (status === SHARE_STATUS.NOT_SHARED) {
    const shares = await ctx.db
      .query('blockShares')
      .withIndex('by_campaign_block_member', (q) =>
        q.eq('campaignId', campaignId).eq('blockId', blockId),
      )
      .collect()

    for (const share of shares) {
      await ctx.db.delete(share._id)
    }

    await removeBlockIfNotNeeded(ctx, campaignId, blockId)
  }
}

export async function shareBlockWithMemberHelper(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  noteId: Id<'notes'>,
  blockItem: BlockItem,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<void> {
  const existingBlock = await findBlockByBlockNoteId(
    ctx,
    noteId,
    blockItem.blockNoteId,
  )

  let blockId: Id<'blocks'>
  if (existingBlock) {
    await updateBlock(ctx, existingBlock._id, {
      content: blockItem.content,
      isTopLevel: true,
      shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
      updatedAt: Date.now(),
    })
    blockId = existingBlock._id
  } else {
    blockId = await insertBlock(ctx, {
      campaignId,
      blockId: blockItem.blockNoteId,
      content: blockItem.content,
      isTopLevel: true,
      noteId,
      now: Date.now(),
      shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
    })
  }

  await shareBlockWithMember(ctx, campaignId, blockId, campaignMemberId)
}

export async function unshareBlockFromMemberHelper(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  noteId: Id<'notes'>,
  blockNoteId: string,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<void> {
  const block = await findBlockByBlockNoteId(ctx, noteId, blockNoteId)
  if (!block || block.campaignId !== campaignId) return

  await unshareBlockFromMember(ctx, campaignId, block._id, campaignMemberId)

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
    })
    await removeBlockIfNotNeeded(ctx, campaignId, block._id)
  }
}

export async function shareBlockWithMember(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  blockId: Id<'blocks'>,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<Id<'blockShares'>> {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  // Verify block exists
  const block = await ctx.db.get(blockId)
  if (!block || block.campaignId !== campaignId) {
    throw new Error('Block not found')
  }

  // Check if share already exists
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

  // Get current session if any
  const currentSession = await getCurrentSession(ctx, campaignId)

  return await ctx.db.insert('blockShares', {
    campaignId,
    blockId,
    campaignMemberId,
    sessionId: currentSession?._id,
  })
}

export async function unshareBlockFromMember(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  blockId: Id<'blocks'>,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<void> {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

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

export async function getBlockSharesForBlock(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  blockId: Id<'blocks'>,
): Promise<Array<BlockShare>> {
  return await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', campaignId).eq('blockId', blockId),
    )
    .collect()
}

export async function getBlockSharesForMember(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<Array<BlockShare>> {
  return await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_member', (q) =>
      q.eq('campaignId', campaignId).eq('campaignMemberId', campaignMemberId),
    )
    .collect()
}

export async function isBlockSharedWithMember(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  blockId: Id<'blocks'>,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<boolean> {
  const share = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('blockId', blockId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  return share !== null
}
