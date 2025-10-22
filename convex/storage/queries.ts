import { query } from '../_generated/server'
import { v } from 'convex/values'

export const getDownloadUrl = query({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})
