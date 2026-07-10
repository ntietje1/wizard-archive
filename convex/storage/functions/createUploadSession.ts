import { FILE_STORAGE_STATUS } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function createUploadSession(
  ctx: AuthMutationCtx,
): Promise<{ sessionId: Id<'fileStorage'>; uploadUrl: string }> {
  const sessionId = await ctx.db.insert('fileStorage', {
    status: FILE_STORAGE_STATUS.Pending,
    storageId: null,
    userId: ctx.user.profile._id,
    originalFileName: null,
  })
  const uploadUrl = await ctx.storage.generateUploadUrl()
  return { sessionId, uploadUrl }
}
