import { v } from 'convex/values'
import { dmQuery } from '../functions'
import { getCampaignMembers } from '../campaigns/campaigns'
import { campaignMemberValidator } from '../campaigns/schema'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import {
  permissionLevelValidator,
  sidebarItemIdValidator,
} from '../sidebarItems/schema/baseValidators'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { requireItemAccess } from '../sidebarItems/validation'
import { blockShareValidator, sidebarItemShareValidator } from './schema'
import { getBlockSharesForBlock } from './blockShares'
import {
  getSidebarItemSharesForItem,
  resolveInheritedPermissionWithSource,
} from './itemShares'
import { PERMISSION_LEVEL } from './types'
import type { Id } from '../_generated/dataModel'
import type { CampaignMember } from '../campaigns/types'
import type { BlockShare, PermissionLevel, SidebarItemShare } from './types'

export const getSidebarItemShares = dmQuery({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
  },
  returns: v.array(sidebarItemShareValidator),
  handler: async (ctx, args): Promise<Array<SidebarItemShare>> => {
    const item = await ctx.db.get(args.sidebarItemId)
    await requireItemAccess(ctx, item, PERMISSION_LEVEL.VIEW)
    return await getSidebarItemSharesForItem(ctx, args.sidebarItemId)
  },
})

/**
 * Get share info for a sidebar item along with player members.
 * Returns allPermissionLevel and individual shares.
 */
export const getSidebarItemWithShares = dmQuery({
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
    memberInheritedPermissions: v.record(
      v.id('campaignMembers'),
      permissionLevelValidator,
    ),
    memberInheritedFromFolderNames: v.record(
      v.id('campaignMembers'),
      v.string(),
    ),
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
    memberInheritedPermissions: Record<Id<'campaignMembers'>, PermissionLevel>
    memberInheritedFromFolderNames: Record<Id<'campaignMembers'>, string>
  }> => {
    const campaignId = ctx.campaign._id

    const item = await ctx.db.get(args.sidebarItemId)
    await requireItemAccess(ctx, item, PERMISSION_LEVEL.VIEW)
    if (!item) {
      throw new Error('Sidebar item not found')
    }

    let inheritShares: boolean | undefined = undefined
    if (item.type === SIDEBAR_ITEM_TYPES.folders) {
      inheritShares = item.inheritShares
    }

    // Get player members
    const allMembers = await getCampaignMembers(ctx, campaignId)
    const playerMembers = allMembers.filter(
      (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
    )

    // Always fetch individual shares
    const shares = await getSidebarItemSharesForItem(ctx, args.sidebarItemId)

    // Resolve inherited all-players permission level with source folder name
    const {
      level: inheritedAllPermissionLevel,
      folderName: inheritedFromFolderName,
    } = await resolveInheritedPermissionWithSource(ctx, item.parentId)

    // Resolve per-member inherited permissions with source folder names
    const memberInheritedPermissions: Record<string, PermissionLevel> = {}
    const memberInheritedFromFolderNames: Record<string, string> = {}
    for (const member of playerMembers) {
      const { level, folderName } = await resolveInheritedPermissionWithSource(
        ctx,
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

export const getBlockShares = dmQuery({
  args: {
    campaignId: v.id('campaigns'),
    blockId: v.id('blocks'),
  },
  returns: v.array(blockShareValidator),
  handler: async (ctx, args): Promise<Array<BlockShare>> => {
    return await getBlockSharesForBlock(ctx, args.blockId)
  },
})
