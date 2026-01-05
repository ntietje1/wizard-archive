import { v } from 'convex/values'
import { query } from '../_generated/server'
import { requireUserIdentity } from '../common/identity'

export const getDownloadUrl = query({
  args: {
    storageId: v.id('_storage'),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args): Promise<string | null> => {
    const { profile } = await requireUserIdentity(ctx)
    const fileStorage = await ctx.db
      .query('fileStorage')
      .withIndex('by_user_storage', (q) =>
        q.eq('userId', profile._id).eq('storageId', args.storageId),
      )
      .unique()
    if (!fileStorage) {
      return null
    }
    return await ctx.storage.getUrl(args.storageId)
  },
})

export const getStorageMetadata = query({
  args: {
    storageId: v.id('_storage'),
  },
  returns: v.union(
    v.null(),
    v.object({
      contentType: v.union(v.string(), v.null()),
      size: v.number(),
      originalFileName: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const { profile } = await requireUserIdentity(ctx)
    const fileStorage = await ctx.db
      .query('fileStorage')
      .withIndex('by_user_storage', (q) =>
        q.eq('userId', profile._id).eq('storageId', args.storageId),
      )
      .unique()
    if (!fileStorage) {
      return null
    }

    const metadata = await ctx.db.system.get(args.storageId)
    if (!metadata) {
      return null
    }

    return {
      contentType: metadata.contentType ?? null,
      size: metadata.size,
      originalFileName: fileStorage.originalFileName ?? null,
    }
  },
})
