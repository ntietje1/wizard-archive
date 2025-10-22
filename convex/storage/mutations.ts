import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireUserIdentity } from '../common/identity'
import { FILE_STORAGE_STATUS } from './types'

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const trackUpload = mutation({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireUserIdentity(ctx)
    return await ctx.db.insert('fileStorage', {
      status: FILE_STORAGE_STATUS.Uncommitted,
      userId: profile._id,
      updatedAt: Date.now(),
      storageId: args.storageId,
    })
  },
})

export const commitUpload = mutation({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireUserIdentity(ctx)
    const fileStorage = await ctx.db
      .query('fileStorage')
      .withIndex('by_user_storage', (q) =>
        q.eq('userId', profile._id).eq('storageId', args.storageId),
      )
      .unique()
    if (!fileStorage) {
      throw new Error('File storage not found')
    }
    if (fileStorage.userId !== profile._id) {
      throw new Error('File storage not found')
    }
    return await ctx.db.patch(fileStorage._id, {
      status: FILE_STORAGE_STATUS.Committed,
      updatedAt: Date.now(),
    })
  },
})
