import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { FILE_STORAGE_STATUS } from '../types'
import { getUserUploadSession } from './getUserUploadSession'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function discardUpload(
  ctx: AuthMutationCtx,
  { sessionId }: { sessionId: Id<'fileStorage'> },
): Promise<null> {
  const fileStorage = await getUserUploadSession(ctx, sessionId, ctx.user.profile._id)
  if (!fileStorage) return null

  if (fileStorage.status === FILE_STORAGE_STATUS.Committed) {
    throwClientError(ERROR_CODE.CONFLICT, 'Committed uploads cannot be discarded')
  }

  if (fileStorage.storageId) {
    await ctx.storage.delete(fileStorage.storageId)
  }
  await ctx.db.delete('fileStorage', fileStorage._id)
  return null
}
