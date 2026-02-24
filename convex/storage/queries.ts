import { v } from 'convex/values'
import { authQuery } from '../functions'
import { getDownloadUrl as getDownloadUrlFn } from './functions/getDownloadUrl'
import { getStorageMetadata as getStorageMetadataFn } from './functions/getStorageMetadata'

export const getDownloadUrl = authQuery({
  args: {
    storageId: v.id('_storage'),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args): Promise<string | null> => {
    return await getDownloadUrlFn(ctx, { storageId: args.storageId })
  },
})

export const getStorageMetadata = authQuery({
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
    return await getStorageMetadataFn(ctx, { storageId: args.storageId })
  },
})
