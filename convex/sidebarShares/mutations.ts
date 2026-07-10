import { v } from 'convex/values'
import { dmMutation } from '../functions'
import { permissionLevelValidator } from '../sidebarItems/schema/validators'
import { setResourceAudiencePermissionForSidebarItems as setResourceAudiencePermissionForSidebarItemsFn } from './functions/setResourceAudiencePermissionForSidebarItems'
import { setFolderInheritShares as setFolderInheritSharesFn } from './functions/setFolderInheritShares'
import {
  clearResourcesMemberPermission as clearResourcesMemberPermissionFn,
  setResourcesMemberPermission as setResourcesMemberPermissionFn,
} from './functions/sidebarItemShareMutations'

export const setResourcesMemberPermission = dmMutation({
  args: {
    sidebarItemIds: v.array(v.id('sidebarItems')),
    campaignMemberId: v.id('campaignMembers'),
    permissionLevel: permissionLevelValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setResourcesMemberPermissionFn(ctx, {
      sidebarItemIds: args.sidebarItemIds,
      campaignMemberId: args.campaignMemberId,
      permissionLevel: args.permissionLevel,
    })
    return null
  },
})

export const clearResourcesMemberPermission = dmMutation({
  args: {
    sidebarItemIds: v.array(v.id('sidebarItems')),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await clearResourcesMemberPermissionFn(ctx, {
      sidebarItemIds: args.sidebarItemIds,
      campaignMemberId: args.campaignMemberId,
    })
    return null
  },
})

export const setResourceAudiencePermissionForSidebarItems = dmMutation({
  args: {
    sidebarItemIds: v.array(v.id('sidebarItems')),
    permissionLevel: v.nullable(permissionLevelValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setResourceAudiencePermissionForSidebarItemsFn(ctx, {
      sidebarItemIds: args.sidebarItemIds,
      permissionLevel: args.permissionLevel,
    })
    return null
  },
})

/**
 * Toggle whether a folder passes its share settings to newly created child items.
 * When enabled, new items inherit the folder's allPermissionLevel and individual shares.
 */
export const setFolderInheritShares = dmMutation({
  args: {
    folderId: v.id('sidebarItems'),
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
