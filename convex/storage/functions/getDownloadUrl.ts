import type { Id } from '../../_generated/dataModel'
import type { AuthQueryCtx } from '../../functions'

export async function getDownloadUrl(
  ctx: AuthQueryCtx,
  storageId: Id<'_storage'>,
): Promise<string | null> {
  const fileStorage = await ctx.db
    .query('fileStorage')
    .withIndex('by_user_storage', (q) =>
      q.eq('userId', ctx.user.profile._id).eq('storageId', storageId),
    )
    .unique()
  if (!fileStorage) {
    return null
  }
  return await ctx.storage.getUrl(storageId)
}
