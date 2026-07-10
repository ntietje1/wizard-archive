import { v } from 'convex/values'
import { authQuery } from '../functions'
import { getStorageMetadata as getStorageMetadataFn } from './functions/getStorageMetadata'

export const getStorageMetadata = authQuery({
  args: {
    storageId: v.id('_storage'),
  },
  returns: v.nullable(
    v.object({
      contentType: v.nullable(v.string()),
      size: v.number(),
      originalFileName: v.nullable(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    return await getStorageMetadataFn(ctx, { storageId: args.storageId })
  },
})
