import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

export async function updateSession(
  ctx: CampaignMutationCtx,
  { sessionId, name }: { sessionId: Id<'sessions'>; name?: string },
): Promise<null> {
  const session = await ctx.db.get(sessionId)
  if (!session || session.campaignId !== ctx.campaign._id) {
    throw new Error('Session not found')
  }

  const updates: Partial<Doc<'sessions'>> = {}
  if (name !== undefined) {
    updates.name = name
  }

  if (Object.keys(updates).length > 0) {
    const now = Date.now()
    updates.updatedTime = now
    updates.updatedBy = ctx.user.profile._id
    await ctx.db.patch(sessionId, updates)
  }

  return null
}
