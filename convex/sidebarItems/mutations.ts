import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { claimPreviewGeneration as claimPreviewGenerationFn } from './functions/claimPreviewGeneration'
import { setPreviewImage as setPreviewImageFn } from './functions/setPreviewImage'
import {
  previewGenerationClaimValidator,
  previewPublicationResultValidator,
} from './previewGeneration'
import type { PreviewGenerationClaim, PreviewPublicationResult } from './previewGeneration'
import { resourceIdValidator } from '../resources/validators'
import { requireSidebarItemRow } from './functions/sidebarItemIdentity'

export const claimPreviewGeneration = campaignMutation({
  args: {
    itemId: resourceIdValidator,
  },
  returns: previewGenerationClaimValidator,
  handler: async (ctx, args): Promise<PreviewGenerationClaim> => {
    const item = await requireSidebarItemRow(ctx, args.itemId)
    return await claimPreviewGenerationFn(ctx, { itemId: item._id })
  },
})

export const setPreviewImage = campaignMutation({
  args: {
    itemId: resourceIdValidator,
    uploadSessionId: v.id('fileStorage'),
    claimToken: v.string(),
  },
  returns: previewPublicationResultValidator,
  handler: async (ctx, args): Promise<PreviewPublicationResult> => {
    const item = await requireSidebarItemRow(ctx, args.itemId)
    return await setPreviewImageFn(ctx, {
      itemId: item._id,
      uploadSessionId: args.uploadSessionId,
      claimToken: args.claimToken,
    })
  },
})
