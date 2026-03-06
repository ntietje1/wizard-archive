import { requireDmRole } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function startSession(
  ctx: AuthMutationCtx,
  { name, campaignId }: { name?: string; campaignId: Id<'campaigns'> },
): Promise<Id<'sessions'>> {
  const { campaign } = await requireDmRole(ctx, campaignId)
  const now = Date.now()

  // End current session if one exists
  if (campaign.currentSessionId) {
    const existingSession = await ctx.db.get(campaign.currentSessionId)
    if (existingSession) {
      await ctx.db.patch(campaign.currentSessionId, {
        endedAt: now,
        updatedTime: now,
        updatedBy: ctx.user.profile._id,
      })
    }
  }

  const sessionId = await ctx.db.insert('sessions', {
    campaignId,
    name,
    startedAt: now,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
    createdBy: ctx.user.profile._id,
  })

  await ctx.db.patch(campaignId, {
    currentSessionId: sessionId,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })

  return sessionId
}
