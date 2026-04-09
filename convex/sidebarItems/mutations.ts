import { v } from 'convex/values'
import { authMutation } from '../functions'
import { sidebarItemIdValidator, sidebarItemLocationValidator } from './schema/baseValidators'
import { moveSidebarItem as moveSidebarItemFn } from './functions/moveSidebarItem'
import { permanentlyDeleteSidebarItem as permanentlyDeleteSidebarItemFn } from './functions/permanentlyDeleteSidebarItem'
import { emptyTrashBin as emptyTrashBinFn } from './functions/emptyTrashBin'
import { claimPreviewGeneration as claimPreviewGenerationFn } from './functions/claimPreviewGeneration'
import { setPreviewImage as setPreviewImageFn } from './functions/setPreviewImage'
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

export const claimPreviewGeneration = authMutation({
  args: {
    itemId: sidebarItemIdValidator,
  },
  returns: v.object({
    claimed: v.boolean(),
    claimToken: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args): Promise<{ claimed: boolean; claimToken: string | null }> => {
    return await claimPreviewGenerationFn(ctx, { itemId: args.itemId })
  },
})

export const setPreviewImage = authMutation({
  args: {
    itemId: sidebarItemIdValidator,
    previewStorageId: v.id('_storage'),
    claimToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await setPreviewImageFn(ctx, {
      itemId: args.itemId,
      previewStorageId: args.previewStorageId,
      claimToken: args.claimToken,
    })
    return null
  },
})
