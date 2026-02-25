import { v } from 'convex/values'
import { dmMutation } from '../functions'
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
import { shareSidebarItem as shareSidebarItemFn } from './functions/shareSidebarItem'
import { unshareSidebarItem as unshareSidebarItemFn } from './functions/unshareSidebarItem'
import { setAllPlayersPermission as setAllPlayersPermissionFn } from './functions/setAllPlayersPermission'
import { setFolderInheritShares as setFolderInheritSharesFn } from './functions/setFolderInheritShares'
import { setBlocksShareStatus as setBlocksShareStatusFn } from './functions/setBlocksShareStatus'
import { shareBlocks as shareBlocksFn } from './functions/shareBlocks'
import { unshareBlocks as unshareBlocksFn } from './functions/unshareBlocks'

/**
 * Share a sidebar item with a specific member.
 * Creates or updates an individual share record.
 */
export const shareSidebarItem = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    sidebarItemType: sidebarItemTypeValidator,
    campaignMemberId: v.id('campaignMembers'),
    permissionLevel: v.optional(permissionLevelValidator),
  },
  returns: v.id('sidebarItemShares'),
  handler: async (ctx, args) => {
    return await shareSidebarItemFn(ctx, {
      sidebarItemId: args.sidebarItemId,
      sidebarItemType: args.sidebarItemType,
      campaignMemberId: args.campaignMemberId,
      permissionLevel: args.permissionLevel,
    })
  },
})

/**
 * Unshare a sidebar item from a specific member.
 * Deletes the individual share record.
 */
export const unshareSidebarItem = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await unshareSidebarItemFn(ctx, {
      sidebarItemId: args.sidebarItemId,
      campaignMemberId: args.campaignMemberId,
    })
  },
})

/**
 * Update the permission level for a specific member's share on a sidebar item.
 * If level is 'none', removes the share. If no share exists for other levels, creates one.
 */
export const updateSidebarItemSharePermission = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    sidebarItemType: sidebarItemTypeValidator,
    campaignMemberId: v.id('campaignMembers'),
    permissionLevel: permissionLevelValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await shareSidebarItemFn(ctx, {
      sidebarItemId: args.sidebarItemId,
      sidebarItemType: args.sidebarItemType,
      campaignMemberId: args.campaignMemberId,
      permissionLevel: args.permissionLevel,
    })
    return null
  },
})

/**
 * Set the default permission level for all players on a sidebar item.
 * Sets allPermissionLevel on the item directly.
 * Individual share overrides are preserved independently.
 */
export const setAllPlayersPermission = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    permissionLevel: v.union(permissionLevelValidator, v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await setAllPlayersPermissionFn(ctx, {
      sidebarItemId: args.sidebarItemId,
      permissionLevel: args.permissionLevel,
    })
  },
})

/**
 * Toggle whether a folder passes its share settings to newly created child items.
 * When enabled, new items inherit the folder's allPermissionLevel and individual shares.
 */
export const setFolderInheritShares = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    folderId: v.id('folders'),
    inheritShares: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await setFolderInheritSharesFn(ctx, {
      folderId: args.folderId,
      inheritShares: args.inheritShares,
    })
  },
})

// ============ Block Share Mutations ============

const blockItemValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  content: customBlockValidator,
})

export const setBlocksShareStatus = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('notes'),
    blocks: v.array(blockItemValidator),
    status: blockShareStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await setBlocksShareStatusFn(ctx, {
      noteId: args.noteId,
      blocks: args.blocks,
      status: args.status,
    })
  },
})

export const shareBlocks = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('notes'),
    blocks: v.array(blockItemValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await shareBlocksFn(ctx, {
      noteId: args.noteId,
      blocks: args.blocks,
      campaignMemberId: args.campaignMemberId,
    })
  },
})

export const unshareBlocks = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('notes'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await unshareBlocksFn(ctx, {
      noteId: args.noteId,
      blockNoteIds: args.blockNoteIds,
      campaignMemberId: args.campaignMemberId,
    })
  },
})
