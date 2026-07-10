import { getUserFileStorage } from './getUserFileStorage'
import { FILE_STORAGE_STATUS } from '../types'
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
  const fileStorage = await getUserFileStorage(ctx, storageId)
  if (!fileStorage || fileStorage.status !== FILE_STORAGE_STATUS.Committed) {
    return null
  }

  const metadata = await ctx.db.system.get('_storage', storageId)
  if (!metadata) {
    return null
  }

  return {
    contentType: metadata.contentType ?? null,
    size: metadata.size,
    originalFileName: fileStorage.originalFileName ?? null,
  }
}
