import { FILE_STORAGE_STATUS } from '../types'
import { validateFileUpload } from '../validation'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function commitUpload(
  ctx: AuthMutationCtx,
  { storageId }: { storageId: Id<'_storage'> },
): Promise<Id<'fileStorage'>> {
  const fileStorage = await ctx.db
    .query('fileStorage')
    .withIndex('by_user_storage', (q) =>
      q.eq('userId', ctx.user.profile._id).eq('storageId', storageId),
    )
    .unique()
  if (!fileStorage) {
    throw new Error('File storage not found')
  }

  // Validate file before committing
  const storageMetadata = await ctx.db.system.get(storageId)
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

  const now = Date.now()

  await ctx.db.patch(fileStorage._id, {
    status: FILE_STORAGE_STATUS.Committed,
    _updatedTime: now,
    _updatedBy: ctx.user.profile._id,
  })
  return fileStorage._id
}
