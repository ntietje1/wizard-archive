import { v } from 'convex/values'
import { authMutation } from '../functions'
import { sidebarItemIdValidator } from './schema/baseValidators'
import { updateSidebarItem as updateSidebarItemFn } from './functions/updateSidebarItem'
import { moveSidebarItem as moveSidebarItemFn } from './functions/moveSidebarItem'
import { permanentlyDeleteSidebarItem as permanentlyDeleteSidebarItemFn } from './functions/permanentlyDeleteSidebarItem'
import { emptyTrashBin as emptyTrashBinFn } from './functions/emptyTrashBin'
import type { SidebarItemId } from './types/baseTypes'

export const updateSidebarItem = authMutation({
  args: {
    itemId: sidebarItemIdValidator,
    name: v.optional(v.string()),
    iconName: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<{ slug: string }> => {
    return await updateSidebarItemFn(ctx, {
      itemId: args.itemId,
      name: args.name,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const moveSidebarItem = authMutation({
  args: {
    itemId: sidebarItemIdValidator,
    parentId: v.optional(v.union(v.id('folders'), v.null())),
    deleted: v.optional(v.boolean()),
  },
  returns: sidebarItemIdValidator,
  handler: async (ctx, args): Promise<SidebarItemId> => {
    return await moveSidebarItemFn(ctx, {
      itemId: args.itemId,
      parentId: args.parentId,
      deleted: args.deleted,
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
