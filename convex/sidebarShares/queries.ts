import { v } from 'convex/values'
import { permissionLevelValidator } from '../sidebarItems/schema/validators'
import { dmQuery } from '../functions'
import { sidebarItemShareValidator } from './schema'
import { getSidebarItemsWithShares as getSidebarItemsWithSharesFn } from './functions/getSidebarItemsWithShares'
import { resourceIdValidator } from '../resources/validators'
import { campaignMemberIdValidator } from '../campaigns/schema'
import { requireSidebarItemRows } from '../sidebarItems/functions/sidebarItemIdentity'

export const getSidebarItemsWithShares = dmQuery({
  args: {
    sidebarItemIds: v.array(resourceIdValidator),
  },
  returns: v.array(
    v.object({
      sidebarItemId: resourceIdValidator,
      allPermissionLevel: v.nullable(permissionLevelValidator),
      inheritShares: v.nullable(v.boolean()),
      shares: v.array(sidebarItemShareValidator),
      inheritedAllPermissionLevel: v.nullable(permissionLevelValidator),
      inheritedFromFolderName: v.nullable(v.string()),
      memberInheritedPermissions: v.record(campaignMemberIdValidator, permissionLevelValidator),
      memberInheritedFromFolderNames: v.record(campaignMemberIdValidator, v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.sidebarItemIds.length > 100) {
      throw new Error('Cannot load shares for more than 100 items at once')
    }
    const items = await requireSidebarItemRows(ctx, args.sidebarItemIds)
    return await getSidebarItemsWithSharesFn(ctx, {
      sidebarItemIds: items.map((item) => item._id),
    })
  },
})
