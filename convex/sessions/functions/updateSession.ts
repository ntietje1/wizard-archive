import { ERROR_CODE, throwClientError } from '../../errors'
import type { Doc, Id } from '../../_generated/dataModel'
import type { DmMutationCtx } from '../../functions'

export async function updateSession(
  ctx: DmMutationCtx,
  { sessionId, name }: { sessionId: Id<'sessions'>; name?: string },
): Promise<null> {
  const session = await ctx.db.get('sessions', sessionId)
  if (!session) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Session not found')
  }

  if (session.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Session does not belong to this campaign')
  }

  const updates: Partial<Doc<'sessions'>> = {}
  if (name !== undefined) {
    updates.name = name
  }

  if (Object.keys(updates).length > 0) {
    await ctx.db.patch('sessions', sessionId, updates)
  }

  return null
}
