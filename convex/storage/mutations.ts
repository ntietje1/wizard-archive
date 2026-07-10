import { v } from 'convex/values'
import { authMutation } from '../functions'
import { bindUpload as bindUploadFn } from './functions/bindUpload'
import { createUploadSession as createUploadSessionFn } from './functions/createUploadSession'
import { discardUpload as discardUploadFn } from './functions/discardUpload'
import type { Id } from '../_generated/dataModel'

export const createUploadSession = authMutation({
  args: {},
  returns: v.object({
    sessionId: v.id('fileStorage'),
    uploadUrl: v.string(),
  }),
  handler: async (ctx): Promise<{ sessionId: Id<'fileStorage'>; uploadUrl: string }> => {
    return await createUploadSessionFn(ctx)
  },
})

export const bindUpload = authMutation({
  args: {
    sessionId: v.id('fileStorage'),
    storageId: v.id('_storage'),
    originalFileName: v.optional(v.string()),
  },
  returns: v.id('fileStorage'),
  handler: async (ctx, args): Promise<Id<'fileStorage'>> => {
    return bindUploadFn(ctx, {
      sessionId: args.sessionId,
      storageId: args.storageId,
      originalFileName: args.originalFileName,
    })
  },
})

export const discardUpload = authMutation({
  args: {
    sessionId: v.id('fileStorage'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    return discardUploadFn(ctx, { sessionId: args.sessionId })
  },
})
