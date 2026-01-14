import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import {
  sidebarItemIdValidator,
  sidebarItemShareStatusValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/baseFields'
import {
  SIDEBAR_ITEM_SHARE_STATUS,
  SIDEBAR_ITEM_TYPES,
} from '../sidebarItems/types'
import {
  blockNoteIdValidator,
  blockShareStatusValidator,
  customBlockValidator,
} from '../blocks/schema'
import {
  findBlockByBlockNoteId,
  removeBlockIfNotNeeded,
  upsertBlock,
} from '../blocks/blocks'
import { BLOCK_SHARE_STATUS } from '../blocks/types'
import {
  shareBlockWithMember,
  shareSidebarItemWithMember,
  unshareBlockFromMember,
  unshareSidebarItemFromMember,
} from './shares'
import type { Id } from '../_generated/dataModel'

/**
 * Set the share status for a sidebar item (used for left-click toggle).
 * - all_shared -> not_shared
 * - not_shared -> all_shared
 * - individually_shared -> not_shared (and clears individual shares)
 */
export const setSidebarItemShareStatus = mutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    status: sidebarItemShareStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const item = await ctx.db.get(args.sidebarItemId)
    if (!item || item.campaignId !== args.campaignId) {
      throw new Error('Sidebar item not found')
    }

    if (item.type === SIDEBAR_ITEM_TYPES.folders) {
      throw new Error('Cannot share folders')
    }

    // Update the item's share status
    await ctx.db.patch(args.sidebarItemId, {
      shareStatus: args.status,
    })

    // If setting to not_shared, clear any individual shares
    if (args.status === SIDEBAR_ITEM_SHARE_STATUS.NOT_SHARED) {
      const shares = await ctx.db
        .query('sidebarItemShares')
        .withIndex('by_campaign_item_member', (q) =>
          q
            .eq('campaignId', args.campaignId)
            .eq('sidebarItemId', args.sidebarItemId),
        )
        .collect()

      for (const share of shares) {
        await ctx.db.delete(share._id)
      }
    }

    return null
  },
})

/**
 * Share a sidebar item with a specific member.
 * Sets shareStatus to 'individually_shared'.
 */
export const shareSidebarItem = mutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    sidebarItemType: sidebarItemTypeValidator,
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.id('sidebarItemShares'),
  handler: async (ctx, args): Promise<Id<'sidebarItemShares'>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    // Set status to individually_shared
    const item = await ctx.db.get(args.sidebarItemId)
    if (!item || item.campaignId !== args.campaignId) {
      throw new Error('Sidebar item not found')
    }

    if (item.shareStatus !== SIDEBAR_ITEM_SHARE_STATUS.INDIVIDUALLY_SHARED) {
      await ctx.db.patch(args.sidebarItemId, {
        shareStatus: SIDEBAR_ITEM_SHARE_STATUS.INDIVIDUALLY_SHARED,
      })
    }

    return await shareSidebarItemWithMember(
      ctx,
      args.campaignId,
      args.sidebarItemId,
      args.sidebarItemType,
      args.campaignMemberId,
    )
  },
})

/**
 * Unshare a sidebar item from a specific member.
 * If no shares remain, sets shareStatus to 'not_shared'.
 */
export const unshareSidebarItem = mutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const item = await ctx.db.get(args.sidebarItemId)
    if (!item || item.campaignId !== args.campaignId) {
      throw new Error('Sidebar item not found')
    }

    await unshareSidebarItemFromMember(
      ctx,
      args.campaignId,
      args.sidebarItemId,
      args.campaignMemberId,
    )

    // Check if any shares remain
    const remainingShares = await ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_item_member', (q) =>
        q
          .eq('campaignId', args.campaignId)
          .eq('sidebarItemId', args.sidebarItemId),
      )
      .first()

    // If no shares remain, set status to not_shared
    if (!remainingShares) {
      await ctx.db.patch(args.sidebarItemId, {
        shareStatus: SIDEBAR_ITEM_SHARE_STATUS.NOT_SHARED,
      })
    }

    return null
  },
})

/**
 * Set the share status for a block (used for left-click toggle).
 * - all_shared -> not_shared
 * - not_shared -> all_shared
 * - individually_shared -> not_shared (and clears individual shares)
 */
export const setBlockShareStatus = mutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('notes'),
    blockNoteId: blockNoteIdValidator,
    status: blockShareStatusValidator,
    content: customBlockValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const note = await ctx.db.get(args.noteId)
    if (!note || note.campaignId !== args.campaignId) {
      throw new Error('Note not found')
    }

    let block = await findBlockByBlockNoteId(ctx, args.noteId, args.blockNoteId)
    if (block && block.campaignId !== args.campaignId) {
      throw new Error('Block not found')
    } else if (!block) {
      const blockId = await upsertBlock(ctx, undefined, {
        campaignId: args.campaignId,
        blockId: args.blockNoteId,
        content: args.content,
        shareStatus: args.status,
        isTopLevel: false,
        noteId: args.noteId,
        now: Date.now(),
      })
      block = await ctx.db.get(blockId)
    }

    if (!block) {
      throw new Error('Block not found')
    }

    await ctx.db.patch(block._id, {
      shareStatus: args.status,
    })

    // If setting to not_shared, clear any individual shares
    if (args.status === BLOCK_SHARE_STATUS.NOT_SHARED) {
      const shares = await ctx.db
        .query('blockShares')
        .withIndex('by_campaign_block_member', (q) =>
          q.eq('campaignId', args.campaignId).eq('blockId', block._id),
        )
        .collect()

      for (const share of shares) {
        await ctx.db.delete(share._id)
      }

      await removeBlockIfNotNeeded(ctx, args.campaignId, block._id)
    }

    return null
  },
})

/**
 * Share a block with a specific member.
 * Sets shareStatus to 'individually_shared'.
 */
export const shareBlock = mutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('notes'),
    blockNoteId: blockNoteIdValidator,
    campaignMemberId: v.id('campaignMembers'),
    content: customBlockValidator,
  },
  returns: v.id('blockShares'),
  handler: async (ctx, args): Promise<Id<'blockShares'>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const note = await ctx.db.get(args.noteId)
    if (!note || note.campaignId !== args.campaignId) {
      throw new Error('Note not found')
    }

    // Set status to individually_shared
    const block = await findBlockByBlockNoteId(
      ctx,
      args.noteId,
      args.blockNoteId,
    )
    if (block && block.campaignId !== args.campaignId) {
      throw new Error('Block not found')
    }

    const blockId = await upsertBlock(ctx, undefined, {
      campaignId: args.campaignId,
      blockId: args.blockNoteId,
      content: args.content,
      isTopLevel: false,
      noteId: args.noteId,
      now: Date.now(),
      shareStatus: BLOCK_SHARE_STATUS.INDIVIDUALLY_SHARED,
    })

    return await shareBlockWithMember(
      ctx,
      args.campaignId,
      blockId,
      args.campaignMemberId,
    )
  },
})

/**
 * Unshare a block from a specific member.
 * If no shares remain, sets shareStatus to 'not_shared'.
 */
export const unshareBlock = mutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('notes'),
    blockNoteId: blockNoteIdValidator,
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const block = await findBlockByBlockNoteId(
      ctx,
      args.noteId,
      args.blockNoteId,
    )
    if (!block || block.campaignId !== args.campaignId) {
      throw new Error('Block not found')
    }

    await unshareBlockFromMember(
      ctx,
      args.campaignId,
      block._id,
      args.campaignMemberId,
    )

    // Check if any shares remain
    const remainingShares = await ctx.db
      .query('blockShares')
      .withIndex('by_campaign_block_member', (q) =>
        q.eq('campaignId', args.campaignId).eq('blockId', block._id),
      )
      .first()

    // If no shares remain, set status to not_shared
    if (!remainingShares) {
      await ctx.db.patch(block._id, {
        shareStatus: BLOCK_SHARE_STATUS.NOT_SHARED,
      })

      await removeBlockIfNotNeeded(ctx, args.campaignId, block._id)
    }

    return null
  },
})
