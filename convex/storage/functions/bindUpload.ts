import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { FILE_STORAGE_STATUS } from '../types'
import { getUserUploadSession } from './getUserUploadSession'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function bindUpload(
  ctx: AuthMutationCtx,
  {
    originalFileName,
    sessionId,
    storageId,
  }: {
    originalFileName?: string
    sessionId: Id<'fileStorage'>
    storageId: Id<'_storage'>
  },
): Promise<Id<'fileStorage'>> {
  const session = await getUserUploadSession(ctx, sessionId, ctx.user.profile._id)
  if (!session) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'The upload session could not be found')
  }

  if (session.status !== FILE_STORAGE_STATUS.Pending) {
    if (session.storageId === storageId) return session._id
    throwClientError(ERROR_CODE.CONFLICT, 'This upload session is already bound to another file')
  }

  const [metadata, existingStorage] = await Promise.all([
    ctx.db.system.get('_storage', storageId),
    ctx.db
      .query('fileStorage')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .first(),
  ])
  if (!metadata || metadata._creationTime < session._creationTime) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'The file was not created by this upload session',
    )
  }
  if (existingStorage) {
    throwClientError(ERROR_CODE.CONFLICT, 'This file already belongs to another upload session')
  }

  await ctx.db.patch('fileStorage', session._id, {
    assetUuid: generateDomainId(DOMAIN_ID_KIND.asset),
    status: FILE_STORAGE_STATUS.Uncommitted,
    storageId,
    originalFileName: originalFileName ?? null,
  })
  return session._id
}
