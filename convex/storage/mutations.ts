import { v } from 'convex/values'
import { authMutation } from '../functions'
import { trackUpload as trackUploadFn } from './functions/trackUpload'
import { commitUpload as commitUploadFn } from './functions/commitUpload'
import type { Id } from '../_generated/dataModel'

export const generateUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const trackUpload = authMutation({
  args: {
    storageId: v.id('_storage'),
    originalFileName: v.optional(v.string()),
  },
  returns: v.id('fileStorage'),
  handler: async (ctx, args): Promise<Id<'fileStorage'>> => {
    return trackUploadFn(ctx, {
      storageId: args.storageId,
      originalFileName: args.originalFileName,
    })
  },
})

export const commitUpload = authMutation({
  args: {
    storageId: v.id('_storage'),
  },
  returns: v.id('fileStorage'),
  handler: async (ctx, args): Promise<Id<'fileStorage'>> => {
    return commitUploadFn(ctx, { storageId: args.storageId })
  },
})
