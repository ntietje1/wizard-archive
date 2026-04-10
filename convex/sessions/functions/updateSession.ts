import { ERROR_CODE, throwClientError } from '../../errors'
import { requireDmRole } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function updateSession(
  ctx: AuthMutationCtx,
  { sessionId, name }: { sessionId: Id<'sessions'>; name?: string },
): Promise<null> {
  const session = await ctx.db.get('sessions', sessionId)
  if (!session) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Session not found')
  }

  await requireDmRole(ctx, session.campaignId)

  const updates: Partial<Doc<'sessions'>> = {}
  if (name !== undefined) {
    updates.name = name
  }

  if (Object.keys(updates).length > 0) {
    const now = Date.now()
    updates.updatedTime = now
    updates.updatedBy = ctx.user.profile._id
    await ctx.db.patch('sessions', sessionId, updates)
  }

  return null
}
