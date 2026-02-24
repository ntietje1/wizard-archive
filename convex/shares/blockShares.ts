import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getCurrentSession } from '../sessions/functions/getCurrentSession'
import {
  findBlockByBlockNoteId,
  insertBlock,
  removeBlockIfNotNeeded,
  updateBlock,
} from '../blocks/blocks'
import { PERMISSION_LEVEL, SHARE_STATUS } from './types'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'
import type { Block } from '../blocks/types'
import type { BlockShare, PermissionLevel, ShareStatus } from './types'
import type { Id } from '../_generated/dataModel'
import type { CustomBlock } from '../notes/editorSpecs'

export async function getBlockPermissionLevel(
  ctx: CampaignQueryCtx,
  { block }: { block: Block },
): Promise<PermissionLevel> {
  const checkId = ctx.membership._id

  if (ctx.membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
    return PERMISSION_LEVEL.EDIT
  }

  const shareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED

  switch (shareStatus) {
    case SHARE_STATUS.ALL_SHARED:
      return PERMISSION_LEVEL.VIEW
    case SHARE_STATUS.INDIVIDUALLY_SHARED: {
      const isShared: boolean = await isBlockSharedWithMember(ctx, {
        blockId: block._id,
        campaignMemberId: checkId,
      })
      return isShared ? PERMISSION_LEVEL.VIEW : PERMISSION_LEVEL.NONE
    }
    case SHARE_STATUS.NOT_SHARED:
      return PERMISSION_LEVEL.NONE
  }
}

export async function enforceBlockSharePermissionsOrNull(
  ctx: CampaignQueryCtx,
  { block }: { block: Block },
): Promise<Block | null> {
  const permissionLevel: PermissionLevel = await getBlockPermissionLevel(ctx, {
    block,
  })
  if (permissionLevel === PERMISSION_LEVEL.NONE) {
    return null
  }

  return block
}

export async function setBlockShareStatusHelper(
  ctx: CampaignMutationCtx,
  {
    noteId,
    blockItem,
    status,
  }: { noteId: Id<'notes'>; blockItem: BlockItem; status: ShareStatus },
): Promise<void> {
  const campaignId = ctx.campaign._id

  const existingBlock = await findBlockByBlockNoteId(ctx, {
    noteId,
    blockId: blockItem.blockNoteId,
  })

  let blockId: Id<'blocks'>
  if (existingBlock) {
    await updateBlock(ctx, {
      blockDbId: existingBlock._id,
      updates: {
        content: blockItem.content,
        shareStatus: status,
        isTopLevel: true,
        updatedAt: Date.now(),
      },
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

    await removeBlockIfNotNeeded(ctx, { blockId })
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
  const campaignId = ctx.campaign._id

  const existingBlock = await findBlockByBlockNoteId(ctx, {
    noteId,
    blockId: blockItem.blockNoteId,
  })

  let blockId: Id<'blocks'>
  if (existingBlock) {
    await updateBlock(ctx, {
      blockDbId: existingBlock._id,
      updates: {
        content: blockItem.content,
        isTopLevel: true,
        shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
        updatedAt: Date.now(),
      },
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

  await shareBlockWithMember(ctx, { blockId, campaignMemberId })
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

  await unshareBlockFromMember(ctx, { blockId: block._id, campaignMemberId })

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
    await removeBlockIfNotNeeded(ctx, { blockId: block._id })
  }
}

export async function shareBlockWithMember(
  ctx: CampaignMutationCtx,
  {
    blockId,
    campaignMemberId,
  }: { blockId: Id<'blocks'>; campaignMemberId: Id<'campaignMembers'> },
): Promise<Id<'blockShares'>> {
  const campaignId = ctx.campaign._id

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
  const currentSession = await getCurrentSession(ctx)

  return await ctx.db.insert('blockShares', {
    campaignId,
    blockId,
    campaignMemberId,
    sessionId: currentSession?._id,
  })
}

export async function unshareBlockFromMember(
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

export async function getBlockSharesForBlock(
  ctx: CampaignQueryCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<Array<BlockShare>> {
  return await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('blockId', blockId),
    )
    .collect()
}

export async function getBlockSharesForMember(
  ctx: CampaignQueryCtx,
  { campaignMemberId }: { campaignMemberId: Id<'campaignMembers'> },
): Promise<Array<BlockShare>> {
  return await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_member', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('campaignMemberId', campaignMemberId),
    )
    .collect()
}

export async function isBlockSharedWithMember(
  ctx: CampaignQueryCtx,
  {
    blockId,
    campaignMemberId,
  }: { blockId: Id<'blocks'>; campaignMemberId: Id<'campaignMembers'> },
): Promise<boolean> {
  const share = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('blockId', blockId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  return share !== null
}

export interface BlockItem {
  blockNoteId: string
  content: CustomBlock
}
