import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { claimPreviewGeneration as claimPreviewGenerationFn } from './functions/claimPreviewGeneration'
import { setPreviewImage as setPreviewImageFn } from './functions/setPreviewImage'
import {
  previewGenerationClaimValidator,
  previewPublicationResultValidator,
} from './previewGeneration'
import type { PreviewGenerationClaim, PreviewPublicationResult } from './previewGeneration'

export const claimPreviewGeneration = campaignMutation({
  args: {
    itemId: v.id('sidebarItems'),
  },
  returns: previewGenerationClaimValidator,
  handler: async (ctx, args): Promise<PreviewGenerationClaim> => {
    return await claimPreviewGenerationFn(ctx, { itemId: args.itemId })
  },
})

export const setPreviewImage = campaignMutation({
  args: {
    itemId: v.id('sidebarItems'),
    uploadSessionId: v.id('fileStorage'),
    claimToken: v.string(),
  },
  returns: previewPublicationResultValidator,
  handler: async (ctx, args): Promise<PreviewPublicationResult> => {
    return await setPreviewImageFn(ctx, {
      itemId: args.itemId,
      uploadSessionId: args.uploadSessionId,
      claimToken: args.claimToken,
    })
  },
})
