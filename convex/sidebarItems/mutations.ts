import { v } from 'convex/values'
import { authMutation } from '../functions'
import {
  sidebarItemIdValidator,
  sidebarItemLocationValidator,
} from './schema/baseValidators'
import { moveSidebarItem as moveSidebarItemFn } from './functions/moveSidebarItem'
import { permanentlyDeleteSidebarItem as permanentlyDeleteSidebarItemFn } from './functions/permanentlyDeleteSidebarItem'
import { emptyTrashBin as emptyTrashBinFn } from './functions/emptyTrashBin'
import type { SidebarItemId } from './types/baseTypes'

export const moveSidebarItem = authMutation({
  args: {
    itemId: sidebarItemIdValidator,
    parentId: v.optional(v.union(v.id('folders'), v.null())),
    location: v.optional(sidebarItemLocationValidator),
  },
  returns: sidebarItemIdValidator,
  handler: async (ctx, args): Promise<SidebarItemId> => {
    return await moveSidebarItemFn(ctx, {
      itemId: args.itemId,
      parentId: args.parentId,
      location: args.location,
    })
  },
})

export const permanentlyDeleteSidebarItem = authMutation({
  args: {
    itemId: sidebarItemIdValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await permanentlyDeleteSidebarItemFn(ctx, { itemId: args.itemId })
    return null
  },
})

export const emptyTrashBin = authMutation({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await emptyTrashBinFn(ctx, { campaignId: args.campaignId })
    return null
  },
})
