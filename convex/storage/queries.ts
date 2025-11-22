import { query } from '../_generated/server'
import { v } from 'convex/values'
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
