import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { claimPreviewGeneration as claimPreviewGenerationFn } from './functions/claimPreviewGeneration'
import { setPreviewImage as setPreviewImageFn } from './functions/setPreviewImage'

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
