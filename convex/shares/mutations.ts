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
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'
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

/**
 * Share a sidebar item with a specific member.
 * Creates or updates an individual share record.
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

    const item = await ctx.db.get(args.sidebarItemId)
    if (!item || item.campaignId !== args.campaignId) {
      throw new Error('Sidebar item not found')
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
 * Deletes the individual share record.
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

    // Create or update the share with the specified permission level
    // (including 'none' — removing the share is handled by unshareSidebarItem/clearMemberPermission)
    await shareSidebarItemWithMember(
      ctx,
      args.campaignId,
      args.sidebarItemId,
      args.sidebarItemType,
      args.campaignMemberId,
      args.permissionLevel,
    )

    return null
  },
})

/**
 * Set the default permission level for all players on a sidebar item.
 * Sets allPermissionLevel on the item directly.
 * Individual share overrides are preserved independently.
 */
export const setAllPlayersPermission = mutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    permissionLevel: v.optional(permissionLevelValidator),
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

    await ctx.db.patch(args.sidebarItemId, {
      allPermissionLevel: args.permissionLevel,
    })

    return null
  },
})

/**
 * Toggle whether a folder passes its share settings to newly created child items.
 * When enabled, new items inherit the folder's allPermissionLevel and individual shares.
 */
export const setFolderInheritShares = mutation({
  args: {
    campaignId: v.id('campaigns'),
    folderId: v.id('folders'),
    inheritShares: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const folder = await ctx.db.get(args.folderId)
    if (!folder || folder.campaignId !== args.campaignId) {
      throw new Error('Folder not found')
    }

    await ctx.db.patch(args.folderId, {
      inheritShares: args.inheritShares,
    })

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
