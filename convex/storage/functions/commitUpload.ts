import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { FILE_STORAGE_STATUS } from '../types'
import { validateFileUploadSize } from '../../../shared/storage/validation'
import { getUserUploadSession } from './getUserUploadSession'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx, CampaignMutationCtx } from '../../functions'

type UploadCommitCtx = AuthMutationCtx | CampaignMutationCtx

export async function commitUpload(
  ctx: UploadCommitCtx,
  { sessionId }: { sessionId: Id<'fileStorage'> },
) {
  const userId = 'membership' in ctx ? ctx.membership.userId : ctx.user.profile._id
  const fileStorage = await getUserUploadSession(ctx, sessionId, userId)
  if (!fileStorage) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'The upload session could not be found')
  }

  if (!fileStorage.storageId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'The upload session has no file')
  }

  const storageMetadata = await ctx.db.system.get('_storage', fileStorage.storageId)
  if (!storageMetadata) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'The uploaded file could not be found')
  }

  const validation = validateFileUploadSize(storageMetadata.size)
  if (!validation.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, validation.error)
  }

  if (fileStorage.status !== FILE_STORAGE_STATUS.Committed) {
    await ctx.db.patch('fileStorage', fileStorage._id, {
      status: FILE_STORAGE_STATUS.Committed,
    })
  }
  return {
    assetId: fileStorage.assetUuid,
    metadata: storageMetadata,
    originalFileName: fileStorage.originalFileName,
    sessionId: fileStorage._id,
    storageId: fileStorage.storageId,
  }
}
