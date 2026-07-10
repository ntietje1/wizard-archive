import type { Doc, Id } from '../../_generated/dataModel'
import type { AuthMutationCtx, CampaignMutationCtx } from '../../functions'

type UploadSessionMutationCtx = AuthMutationCtx | CampaignMutationCtx

export async function getUserUploadSession(
  ctx: UploadSessionMutationCtx,
  sessionId: Id<'fileStorage'>,
  userId: Id<'userProfiles'>,
): Promise<Doc<'fileStorage'> | null> {
  const session = await ctx.db.get('fileStorage', sessionId)
  return session?.userId === userId ? session : null
}
