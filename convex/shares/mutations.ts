import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import {
  blockNoteIdValidator,
  blockShareStatusValidator,
  customBlockValidator,
} from '../blocks/schema'
import {
  permissionLevelValidator,
  sidebarItemIdValidator,
  sidebarItemShareStatusValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { SHARE_STATUS } from './types'
import {
  setBlockShareStatusHelper,
  shareBlockWithMemberHelper,
  unshareBlockFromMemberHelper,
} from './blockShares'
import {
  shareSidebarItemWithMember,
  unshareSidebarItemFromMember,
} from './itemShares'
import type { Id } from '../_generated/dataModel'
import type { PermissionLevel, ShareStatus } from './types'

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
    allPermissionLevel: v.optional(permissionLevelValidator),
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

    // Update the item's share status and optional allPermissionLevel
    const patch: {
      shareStatus: ShareStatus
      allPermissionLevel?: PermissionLevel
    } = {
      shareStatus: args.status,
    }
    if (args.allPermissionLevel !== undefined) {
      patch.allPermissionLevel = args.allPermissionLevel
    }
    await ctx.db.patch(args.sidebarItemId, patch)

    // If setting to not_shared, clear any individual shares
    if (args.status === SHARE_STATUS.NOT_SHARED) {
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
    permissionLevel: v.optional(permissionLevelValidator),
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

    if (item.shareStatus !== SHARE_STATUS.INDIVIDUALLY_SHARED) {
      await ctx.db.patch(args.sidebarItemId, {
        shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
      })
    }

    return await shareSidebarItemWithMember(
      ctx,
      args.campaignId,
      args.sidebarItemId,
      args.sidebarItemType,
      args.campaignMemberId,
      args.permissionLevel,
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
        shareStatus: SHARE_STATUS.NOT_SHARED,
      })
    }

    return null
  },
})

/**
 * Update the permission level for a specific member's share on a sidebar item.
 * If level is 'none', removes the share. If no share exists for other levels, creates one.
 */
export const updateSidebarItemSharePermission = mutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    sidebarItemType: sidebarItemTypeValidator,
    campaignMemberId: v.id('campaignMembers'),
    permissionLevel: permissionLevelValidator,
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

    if (args.permissionLevel === 'none') {
      // Remove the share
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

      if (!remainingShares) {
        await ctx.db.patch(args.sidebarItemId, {
          shareStatus: SHARE_STATUS.NOT_SHARED,
        })
      }
    } else {
      // Create or update the share with the new permission level
      if (item.shareStatus !== SHARE_STATUS.INDIVIDUALLY_SHARED) {
        await ctx.db.patch(args.sidebarItemId, {
          shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
        })
      }

      await shareSidebarItemWithMember(
        ctx,
        args.campaignId,
        args.sidebarItemId,
        args.sidebarItemType,
        args.campaignMemberId,
        args.permissionLevel,
      )
    }

    return null
  },
})

/**
 * Set the permission level for all players on a sidebar item.
 * Sets shareStatus to 'all_shared' with the given permission level, or 'not_shared' if level is 'none'.
 */
export const setAllPlayersPermission = mutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    permissionLevel: permissionLevelValidator,
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

    if (args.permissionLevel === 'none') {
      // Unshare from all - clear individual shares too
      await ctx.db.patch(args.sidebarItemId, {
        shareStatus: SHARE_STATUS.NOT_SHARED,
        allPermissionLevel: undefined, // TODO: remove allPermissionLevel entirely
      })

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
    } else {
      // Share with all at the given permission level
      await ctx.db.patch(args.sidebarItemId, {
        shareStatus: SHARE_STATUS.ALL_SHARED,
        allPermissionLevel: args.permissionLevel,
      })
    }

    return null
  },
})

// ============ Block Share Mutations ============

const blockItemValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  content: customBlockValidator,
})

export const setBlocksShareStatus = mutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('notes'),
    blocks: v.array(blockItemValidator),
    status: blockShareStatusValidator,
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

    for (const blockItem of args.blocks) {
      await setBlockShareStatusHelper(
        ctx,
        args.campaignId,
        args.noteId,
        blockItem,
        args.status,
      )
    }

    return null
  },
})

export const shareBlocks = mutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('notes'),
    blocks: v.array(blockItemValidator),
    campaignMemberId: v.id('campaignMembers'),
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

    for (const blockItem of args.blocks) {
      await shareBlockWithMemberHelper(
        ctx,
        args.campaignId,
        args.noteId,
        blockItem,
        args.campaignMemberId,
      )
    }

    return null
  },
})

export const unshareBlocks = mutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('notes'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    for (const blockNoteId of args.blockNoteIds) {
      await unshareBlockFromMemberHelper(
        ctx,
        args.campaignId,
        args.noteId,
        blockNoteId,
        args.campaignMemberId,
      )
    }

    return null
  },
})
