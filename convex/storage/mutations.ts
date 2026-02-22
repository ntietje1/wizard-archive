import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { authMutation } from '../functions'
import { FILE_STORAGE_STATUS } from './types'
import { validateFileUpload } from './validation'
import type { Id } from '../_generated/dataModel'

export const generateUploadUrl = mutation({
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
    return await ctx.db.insert('fileStorage', {
      status: FILE_STORAGE_STATUS.Uncommitted,
      userId: ctx.user.profile._id,
      updatedAt: Date.now(),
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
    const fileStorage = await ctx.db
      .query('fileStorage')
      .withIndex('by_user_storage', (q) =>
        q.eq('userId', ctx.user.profile._id).eq('storageId', args.storageId),
      )
      .unique()
    if (!fileStorage) {
      throw new Error('File storage not found')
    }

    // Validate file before committing
    const storageMetadata = await ctx.db.system.get(args.storageId)
    if (!storageMetadata) {
      throw new Error('Storage metadata not found')
    }

    const validation = validateFileUpload(
      storageMetadata.contentType ?? null,
      storageMetadata.size,
      fileStorage.originalFileName,
    )
    if (!validation.success) {
      throw new Error(validation.error)
    }

    await ctx.db.patch(fileStorage._id, {
      status: FILE_STORAGE_STATUS.Committed,
      updatedAt: Date.now(),
    })
    return fileStorage._id
  },
})
