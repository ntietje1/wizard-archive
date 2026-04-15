import { v } from 'convex/values'
import { campaignMutation, dmMutation } from '../functions'
import { sidebarItemLocationValidator } from './schema/validators'
import { moveSidebarItem as moveSidebarItemFn } from './functions/moveSidebarItem'
import { permanentlyDeleteSidebarItem as permanentlyDeleteSidebarItemFn } from './functions/permanentlyDeleteSidebarItem'
import { emptyTrashBin as emptyTrashBinFn } from './functions/emptyTrashBin'
import { claimPreviewGeneration as claimPreviewGenerationFn } from './functions/claimPreviewGeneration'
import { setPreviewImage as setPreviewImageFn } from './functions/setPreviewImage'
import type { Id } from '../_generated/dataModel'

export const moveSidebarItem = campaignMutation({
  args: {
    itemId: v.id('sidebarItems'),
    parentId: v.optional(v.nullable(v.id('sidebarItems'))),
    location: v.optional(sidebarItemLocationValidator),
  },
  returns: v.id('sidebarItems'),
  handler: async (ctx, args): Promise<Id<'sidebarItems'>> => {
    return await moveSidebarItemFn(ctx, {
      itemId: args.itemId,
      parentId: args.parentId,
      location: args.location,
    })
  },
})

export const permanentlyDeleteSidebarItem = campaignMutation({
  args: {
    itemId: v.id('sidebarItems'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await permanentlyDeleteSidebarItemFn(ctx, { itemId: args.itemId })
    return null
  },
})

export const emptyTrashBin = dmMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await emptyTrashBinFn(ctx)
    return null
  },
})

export const claimPreviewGeneration = campaignMutation({
  args: {
    itemId: v.id('sidebarItems'),
  },
  returns: v.object({
    claimed: v.boolean(),
    claimToken: v.nullable(v.string()),
  }),
  handler: async (ctx, args): Promise<{ claimed: boolean; claimToken: string | null }> => {
    return await claimPreviewGenerationFn(ctx, { itemId: args.itemId })
  },
})

export const setPreviewImage = campaignMutation({
  args: {
    itemId: v.id('sidebarItems'),
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
