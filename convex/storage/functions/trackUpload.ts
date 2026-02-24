import { FILE_STORAGE_STATUS } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function trackUpload(
  ctx: AuthMutationCtx,
  {
    storageId,
    originalFileName,
  }: { storageId: Id<'_storage'>; originalFileName?: string },
): Promise<Id<'fileStorage'>> {
  const now = Date.now()

  return await ctx.db.insert('fileStorage', {
    status: FILE_STORAGE_STATUS.Uncommitted,
    userId: ctx.user.profile._id,
    storageId,
    originalFileName,
    _updatedTime: now,
    _updatedBy: ctx.user.profile._id,
    _createdBy: ctx.user.profile._id,
  })
}
