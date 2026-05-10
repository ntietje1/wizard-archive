import { v } from 'convex/values'
import { permissionLevelValidator } from '../sidebarItems/schema/validators'
import { dmQuery } from '../functions'
import { sidebarItemShareValidator } from './schema'
import { getSidebarItemsWithShares as getSidebarItemsWithSharesFn } from './functions/getSidebarItemsWithShares'

export const getSidebarItemsWithShares = dmQuery({
  args: {
    sidebarItemIds: v.array(v.id('sidebarItems')),
  },
  returns: v.array(
    v.object({
      sidebarItemId: v.id('sidebarItems'),
      allPermissionLevel: v.nullable(permissionLevelValidator),
      inheritShares: v.nullable(v.boolean()),
      shares: v.array(sidebarItemShareValidator),
      inheritedAllPermissionLevel: v.nullable(permissionLevelValidator),
      inheritedFromFolderName: v.nullable(v.string()),
      memberInheritedPermissions: v.record(v.id('campaignMembers'), permissionLevelValidator),
      memberInheritedFromFolderNames: v.record(v.id('campaignMembers'), v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.sidebarItemIds.length > 100) {
      throw new Error('Cannot load shares for more than 100 items at once')
    }
    return await getSidebarItemsWithSharesFn(ctx, {
      sidebarItemIds: args.sidebarItemIds,
    })
  },
})
