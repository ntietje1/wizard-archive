import { v } from 'convex/values'
import { authMutation } from '../functions'
import {
  sidebarItemIdValidator,
  sidebarItemLocationValidator,
} from './schema/baseValidators'
import { moveSidebarItem as moveSidebarItemFn } from './functions/moveSidebarItem'
import { permanentlyDeleteSidebarItem as permanentlyDeleteSidebarItemFn } from './functions/permanentlyDeleteSidebarItem'
import { emptyTrashBin as emptyTrashBinFn } from './functions/emptyTrashBin'
import {
  claimThumbnailGeneration as claimThumbnailGenerationFn,
  commitThumbnail as commitThumbnailFn,
} from './functions/thumbnailGeneration'
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

export const claimThumbnailGeneration = authMutation({
  args: {
    itemId: sidebarItemIdValidator,
  },
  returns: v.object({
    claimed: v.boolean(),
    reason: v.optional(v.union(v.literal('too_recent'), v.literal('locked'))),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ claimed: boolean; reason?: 'too_recent' | 'locked' }> => {
    return await claimThumbnailGenerationFn(ctx, { itemId: args.itemId })
  },
})

export const commitThumbnail = authMutation({
  args: {
    itemId: sidebarItemIdValidator,
    thumbnailStorageId: v.id('_storage'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await commitThumbnailFn(ctx, {
      itemId: args.itemId,
      thumbnailStorageId: args.thumbnailStorageId,
    })
    return null
  },
})
