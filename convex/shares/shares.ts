import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getCurrentSession } from '../sessions/sessions'
import {
  findBlockByBlockNoteId,
  insertBlock,
  removeBlockIfNotNeeded,
  updateBlock,
} from '../blocks/blocks'
import { BLOCK_SHARE_STATUS } from '../blocks/types'
import type { BlockShareStatus } from '../blocks/types'
import type { CustomBlock } from '../notes/editorSpecs'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { SidebarItemId, SidebarItemType } from '../sidebarItems/types'
import type { BlockShare, SidebarItemShare } from './types'

// ============ Sidebar Item Shares ============

export async function shareSidebarItemWithMember(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  sidebarItemId: SidebarItemId,
  sidebarItemType: SidebarItemType,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<Id<'sidebarItemShares'>> {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  // Check if share already exists
  const existingShare = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (existingShare) {
    return existingShare._id
  }

  // Get current session if any
  const currentSession = await getCurrentSession(ctx, campaignId)

  return await ctx.db.insert('sidebarItemShares', {
    campaignId,
    sidebarItemId,
    sidebarItemType,
    campaignMemberId,
    sessionId: currentSession?._id,
  })
}

export async function unshareSidebarItemFromMember(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  sidebarItemId: SidebarItemId,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<void> {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const share = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (share) {
    await ctx.db.delete(share._id)
  }
}

export async function getSidebarItemSharesForItem(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  sidebarItemId: SidebarItemId,
): Promise<Array<SidebarItemShare>> {
  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .collect()
}

export async function getSidebarItemSharesForMember(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<Array<SidebarItemShare>> {
  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_member', (q) =>
      q.eq('campaignId', campaignId).eq('campaignMemberId', campaignMemberId),
    )
    .collect()
}

export async function isSidebarItemSharedWithMember(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  sidebarItemId: SidebarItemId,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<boolean> {
  const share = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  return share !== null
}

export interface BlockItem {
  blockNoteId: string
  content: CustomBlock
}

export async function setBlockShareStatusHelper(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  noteId: Id<'notes'>,
  blockItem: BlockItem,
  status: BlockShareStatus,
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
  if (status === BLOCK_SHARE_STATUS.NOT_SHARED) {
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
      shareStatus: BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED,
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
      shareStatus: BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED,
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
      shareStatus: BLOCK_SHARE_STATUS.NOT_SHARED,
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

// ============ Session-based queries ============

export async function getSharesForSession(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  sessionId: Id<'sessions'>,
): Promise<{
  sidebarItemShares: Array<SidebarItemShare>
  blockShares: Array<BlockShare>
}> {
  const [sidebarItemShares, blockShares] = await Promise.all([
    ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_session', (q) =>
        q.eq('campaignId', campaignId).eq('sessionId', sessionId),
      )
      .collect(),
    ctx.db
      .query('blockShares')
      .withIndex('by_campaign_session', (q) =>
        q.eq('campaignId', campaignId).eq('sessionId', sessionId),
      )
      .collect(),
  ])

  return { sidebarItemShares, blockShares }
}
