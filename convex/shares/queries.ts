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
  sidebarItemShareStatusValidator,
  sidebarItemTypeValidator,
} from '../sidebarItems/schema/baseValidators'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { SHARE_STATUS } from './types'
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
  isSidebarItemSharedWithMember,
} from './itemShares'
import type { CampaignMember } from '../campaigns/types'
import type {
  BlockShare,
  PermissionLevel,
  ShareStatus,
  SidebarItemShare,
} from './types'

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
 * Get share status for a sidebar item along with player members.
 * Returns shareStatus and player members in a single query to avoid waterfalls.
 *
 * Share status optimization:
 * - 'all_shared': Item visible to all players (shares array will be empty)
 * - 'not_shared': Item visible to no players (shares array will be empty)
 * - 'individually_shared': Must query sidebarItemShares table for specific shares
 */
export const getSidebarItemWithShares = query({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
  },
  returns: v.object({
    shareStatus: sidebarItemShareStatusValidator,
    allPermissionLevel: v.optional(permissionLevelValidator),
    shares: v.array(sidebarItemShareValidator), // Only populated if individually_shared
    playerMembers: v.array(campaignMemberValidator),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    shareStatus: ShareStatus
    allPermissionLevel?: PermissionLevel
    shares: Array<SidebarItemShare>
    playerMembers: Array<CampaignMember>
  }> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    // Get the sidebar item to retrieve its shareStatus
    const item = await ctx.db.get(args.sidebarItemId)
    if (!item) {
      throw new Error('Sidebar item not found')
    }

    // Get share status (default to 'not_shared' for legacy items)
    const shareStatus: ShareStatus = item.shareStatus ?? SHARE_STATUS.NOT_SHARED
    const allPermissionLevel = (
      item as { allPermissionLevel?: PermissionLevel }
    ).allPermissionLevel

    // Get player members (always needed for UI)
    const allMembers = await getCampaignMembers(ctx, args.campaignId)
    const playerMembers = allMembers.filter(
      (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
    )

    // Only fetch individual shares if status is 'individually_shared'
    let shares: Array<SidebarItemShare> = []
    if (shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED) {
      shares = await getSidebarItemSharesForItem(
        ctx,
        args.campaignId,
        args.sidebarItemId,
      )
    }

    return {
      shareStatus,
      allPermissionLevel,
      shares,
      playerMembers,
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

    return await isSidebarItemSharedWithMember(
      ctx,
      args.campaignId,
      args.sidebarItemId,
      campaignWithMembership.member._id,
    )
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
