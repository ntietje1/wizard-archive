import type { Id } from '../../_generated/dataModel'
import type { AuthQueryCtx } from '../../functions'

export async function getStorageMetadata(
  ctx: AuthQueryCtx,
  { storageId }: { storageId: Id<'_storage'> },
): Promise<{
  contentType: string | null
  size: number
  originalFileName: string | null
} | null> {
  const fileStorage = await ctx.db
    .query('fileStorage')
    .withIndex('by_user_storage', (q) =>
      q.eq('userId', ctx.user.profile._id).eq('storageId', storageId),
    )
    .unique()
  if (!fileStorage) {
    return null
  }

  const metadata = await ctx.db.system.get(storageId)
  if (!metadata) {
    return null
  }

  return {
    contentType: metadata.contentType ?? null,
    size: metadata.size,
    originalFileName: fileStorage.originalFileName ?? null,
  }
}
