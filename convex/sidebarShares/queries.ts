import { v } from 'convex/values'
import { dmQuery } from '../functions'
import {
  permissionLevelValidator,
  sidebarItemIdValidator,
} from '../sidebarItems/schema/baseValidators'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { sidebarItemShareValidator } from './schema'
import { getSidebarItemShares as getSidebarItemSharesFn } from './functions/getSidebarItemShares'
import { getSidebarItemWithShares as getSidebarItemWithSharesFn } from './functions/getSidebarItemWithShares'

export const getSidebarItemShares = dmQuery({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
  },
  returns: v.array(sidebarItemShareValidator),
  handler: async (ctx, args) => {
    return await getSidebarItemSharesFn(ctx, {
      sidebarItemId: args.sidebarItemId,
    })
  },
})

/**
 * Get share info for a sidebar item.
 * Returns allPermissionLevel, individual shares, and inherited permissions.
 * Player member list is fetched client-side via useCampaignMembers().
 */
export const getSidebarItemWithShares = dmQuery({
  args: {
    campaignId: v.id('campaigns'),
    sidebarItemId: sidebarItemIdValidator,
  },
  returns: v.object({
    allPermissionLevel: v.union(permissionLevelValidator, v.null()),
    inheritShares: v.union(v.boolean(), v.null()),
    shares: v.array(sidebarItemShareValidator),
    inheritedAllPermissionLevel: v.union(permissionLevelValidator, v.null()),
    inheritedFromFolderName: v.union(v.string(), v.null()),
    memberInheritedPermissions: v.record(
      v.id('campaignMembers'),
      permissionLevelValidator,
    ),
    memberInheritedFromFolderNames: v.record(
      v.id('campaignMembers'),
      v.string(),
    ),
  }),
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign_user', (q) =>
        q.eq('campaignId', ctx.campaign._id),
      )
      .collect()
    const playerMemberIds = members
      .filter((m) => m.role === CAMPAIGN_MEMBER_ROLE.Player)
      .map((m) => m._id)

    return await getSidebarItemWithSharesFn(ctx, {
      sidebarItemId: args.sidebarItemId,
      playerMemberIds,
    })
  },
})
