import type { Doc, Id } from '../../_generated/dataModel'
import type { AuthMutationCtx, AuthQueryCtx } from '../../functions'

type UserFileStorageCtx = AuthMutationCtx | AuthQueryCtx

export async function getUserFileStorage(
  ctx: UserFileStorageCtx,
  storageId: Id<'_storage'>,
): Promise<Doc<'fileStorage'> | null> {
  return await ctx.db
    .query('fileStorage')
    .withIndex('by_user_storage', (q) =>
      q.eq('userId', ctx.user.profile._id).eq('storageId', storageId),
    )
    .first()
}
