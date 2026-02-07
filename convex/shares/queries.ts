import { v } from 'convex/values'
import { query } from '../_generated/server'
import {
  getCampaignMembers,
  requireCampaignMembership,
} from '../campaigns/campaigns'
import { campaignMemberValidator } from '../campaigns/schema'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import {
  permissionLevelValidator,
  sidebarItemIdValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { blockShareValidator, sidebarItemShareValidator } from './schema'
import {
  getBlockSharesForBlock,
  getBlockSharesForMember,
  isBlockSharedWithMember,
} from './blockShares'
import { getSharesForSession } from './shares'
import {
  getSidebarItemPermissionLevel,
  getSidebarItemSharesForItem,
  resolveInheritedPermissionWithSource,
} from './itemShares'
import { PERMISSION_LEVEL } from './types'
import type { CampaignMember } from '../campaigns/types'
import type { BlockShare, PermissionLevel, SidebarItemShare } from './types'

export const getSidebarItemShares = query({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
  },
  returns: v.array(sidebarItemShareValidator),
  handler: async (ctx, args): Promise<Array<SidebarItemShare>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
    return await getSidebarItemSharesForItem(
      ctx,
      args.campaignId,
      args.sidebarItemId,
    )
  },
})

/**
 * Get share info for a sidebar item along with player members.
 * Returns allPermissionLevel and individual shares.
 */
export const getSidebarItemWithShares = query({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
  },
  returns: v.object({
    allPermissionLevel: v.optional(permissionLevelValidator),
    inheritShares: v.optional(v.boolean()),
    shares: v.array(sidebarItemShareValidator),
    playerMembers: v.array(campaignMemberValidator),
    inheritedAllPermissionLevel: v.optional(permissionLevelValidator),
    inheritedFromFolderName: v.optional(v.string()),
    memberInheritedPermissions: v.record(v.string(), permissionLevelValidator),
    memberInheritedFromFolderNames: v.record(v.string(), v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    allPermissionLevel?: PermissionLevel
    inheritShares?: boolean
    shares: Array<SidebarItemShare>
    playerMembers: Array<CampaignMember>
    inheritedAllPermissionLevel?: PermissionLevel
    inheritedFromFolderName?: string
    memberInheritedPermissions: Record<string, PermissionLevel>
    memberInheritedFromFolderNames: Record<string, string>
  }> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const item = await ctx.db.get(args.sidebarItemId)
    if (!item) {
      throw new Error('Sidebar item not found')
    }

    let inheritShares: boolean | undefined = undefined
    if (item.type === SIDEBAR_ITEM_TYPES.folders) {
      inheritShares = item.inheritShares
    }

    // Get player members
    const allMembers = await getCampaignMembers(ctx, args.campaignId)
    const playerMembers = allMembers.filter(
      (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
    )

    // Always fetch individual shares
    const shares = await getSidebarItemSharesForItem(
      ctx,
      args.campaignId,
      args.sidebarItemId,
    )

    // Resolve inherited all-players permission level with source folder name
    const {
      level: inheritedAllPermissionLevel,
      folderName: inheritedFromFolderName,
    } = await resolveInheritedPermissionWithSource(
      ctx,
      args.campaignId,
      item.parentId,
    )

    // Resolve per-member inherited permissions with source folder names
    const memberInheritedPermissions: Record<string, PermissionLevel> = {}
    const memberInheritedFromFolderNames: Record<string, string> = {}
    for (const member of playerMembers) {
      const { level, folderName } = await resolveInheritedPermissionWithSource(
        ctx,
        args.campaignId,
        item.parentId,
        member._id,
      )
      memberInheritedPermissions[member._id] = level ?? PERMISSION_LEVEL.NONE
      if (folderName) {
        memberInheritedFromFolderNames[member._id] = folderName
      }
    }

    return {
      allPermissionLevel: item.allPermissionLevel,
      inheritShares,
      shares,
      playerMembers,
      inheritedAllPermissionLevel,
      inheritedFromFolderName,
      memberInheritedPermissions,
      memberInheritedFromFolderNames,
    }
  },
})

export const getBlockShares = query({
  args: {
    campaignId: v.id('campaigns'),
    blockId: v.id('blocks'),
  },
  returns: v.array(blockShareValidator),
  handler: async (ctx, args): Promise<Array<BlockShare>> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
    return await getBlockSharesForBlock(ctx, args.campaignId, args.blockId)
  },
})

export const getMySharedBlocks = query({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(blockShareValidator),
  handler: async (ctx, args): Promise<Array<BlockShare>> => {
    const { campaignWithMembership } = await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )
    return await getBlockSharesForMember(
      ctx,
      args.campaignId,
      campaignWithMembership.member._id,
    )
  },
})

export const checkSidebarItemAccess = query({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
    sidebarItemType: sidebarItemTypeValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const { campaignWithMembership } = await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    // DMs have access to everything
    if (campaignWithMembership.member.role === CAMPAIGN_MEMBER_ROLE.DM) {
      return true
    }

    const item = await ctx.db.get(args.sidebarItemId)
    if (!item) return false

    const enhanced = await enhanceSidebarItem(
      ctx,
      item as Parameters<typeof enhanceSidebarItem>[1],
    )

    const level = await getSidebarItemPermissionLevel(ctx, enhanced)
    return level !== 'none'
  },
})

export const checkBlockAccess = query({
  args: {
    campaignId: v.id('campaigns'),
    blockId: v.id('blocks'),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const { campaignWithMembership } = await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    // DMs have access to everything
    if (campaignWithMembership.member.role === CAMPAIGN_MEMBER_ROLE.DM) {
      return true
    }

    return await isBlockSharedWithMember(
      ctx,
      args.campaignId,
      args.blockId,
      campaignWithMembership.member._id,
    )
  },
})

export const getMyPermissionLevel = query({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
  },
  returns: permissionLevelValidator,
  handler: async (ctx, args): Promise<PermissionLevel> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    const item = await ctx.db.get(args.sidebarItemId)
    if (!item) return 'none'

    const enhanced = await enhanceSidebarItem(
      ctx,
      item as Parameters<typeof enhanceSidebarItem>[1],
    )
    return await getSidebarItemPermissionLevel(ctx, enhanced)
  },
})

export const getSessionShares = query({
  args: {
    campaignId: v.id('campaigns'),
    sessionId: v.id('sessions'),
  },
  returns: v.object({
    sidebarItemShares: v.array(sidebarItemShareValidator),
    blockShares: v.array(blockShareValidator),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    sidebarItemShares: Array<SidebarItemShare>
    blockShares: Array<BlockShare>
  }> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
    return await getSharesForSession(ctx, args.campaignId, args.sessionId)
  },
})
