import { v } from 'convex/values'
import { dmMutation } from '../functions'
import { permissionLevelValidator } from '../sidebarItems/schema/validators'
import { setAllPlayersPermissionForSidebarItems as setAllPlayersPermissionForSidebarItemsFn } from './functions/setAllPlayersPermissionForSidebarItems'
import { setFolderInheritShares as setFolderInheritSharesFn } from './functions/setFolderInheritShares'
import {
  clearSidebarItemsMemberPermission as clearSidebarItemsMemberPermissionFn,
  setSidebarItemsMemberPermission as setSidebarItemsMemberPermissionFn,
} from './functions/sidebarItemShareMutations'

export const setSidebarItemsMemberPermission = dmMutation({
  args: {
    sidebarItemIds: v.array(v.id('sidebarItems')),
    campaignMemberId: v.id('campaignMembers'),
    permissionLevel: permissionLevelValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setSidebarItemsMemberPermissionFn(ctx, {
      sidebarItemIds: args.sidebarItemIds,
      campaignMemberId: args.campaignMemberId,
      permissionLevel: args.permissionLevel,
    })
    return null
  },
})

export const clearSidebarItemsMemberPermission = dmMutation({
  args: {
    sidebarItemIds: v.array(v.id('sidebarItems')),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await clearSidebarItemsMemberPermissionFn(ctx, {
      sidebarItemIds: args.sidebarItemIds,
      campaignMemberId: args.campaignMemberId,
    })
    return null
  },
})

export const setAllPlayersPermissionForSidebarItems = dmMutation({
  args: {
    sidebarItemIds: v.array(v.id('sidebarItems')),
    permissionLevel: v.nullable(permissionLevelValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setAllPlayersPermissionForSidebarItemsFn(ctx, {
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
