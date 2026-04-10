import { v } from 'convex/values'
import {
  permissionLevelValidator,
  sidebarItemIdValidator,
} from '../sidebarItems/schema/baseValidators'
import { authQuery } from '../functions'
import { sidebarItemShareValidator } from './schema'
import { getSidebarItemShares as getSidebarItemSharesFn } from './functions/getSidebarItemShares'
import { getSidebarItemWithShares as getSidebarItemWithSharesFn } from './functions/getSidebarItemWithShares'

export const getSidebarItemShares = authQuery({
  args: {
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
 */
export const getSidebarItemWithShares = authQuery({
  args: {
    sidebarItemId: sidebarItemIdValidator,
  },
  returns: v.object({
    allPermissionLevel: v.nullable(permissionLevelValidator),
    inheritShares: v.nullable(v.boolean()),
    shares: v.array(sidebarItemShareValidator),
    inheritedAllPermissionLevel: v.nullable(permissionLevelValidator),
    inheritedFromFolderName: v.nullable(v.string()),
    memberInheritedPermissions: v.record(v.id('campaignMembers'), permissionLevelValidator),
    memberInheritedFromFolderNames: v.record(v.id('campaignMembers'), v.string()),
  }),
  handler: async (ctx, args) => {
    return await getSidebarItemWithSharesFn(ctx, {
      sidebarItemId: args.sidebarItemId,
    })
  },
})
