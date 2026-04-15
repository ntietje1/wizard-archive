import { v } from 'convex/values'
import { permissionLevelValidator } from '../sidebarItems/schema/validators'
import { dmQuery } from '../functions'
import { sidebarItemShareValidator } from './schema'
import { getSidebarItemShares as getSidebarItemSharesFn } from './functions/getSidebarItemShares'
import { getSidebarItemWithShares as getSidebarItemWithSharesFn } from './functions/getSidebarItemWithShares'

export const getSidebarItemShares = dmQuery({
  args: {
    sidebarItemId: v.id('sidebarItems'),
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
export const getSidebarItemWithShares = dmQuery({
  args: {
    sidebarItemId: v.id('sidebarItems'),
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
