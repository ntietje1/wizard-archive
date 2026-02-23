import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

export async function startSession(
  ctx: CampaignMutationCtx,
  name?: string,
): Promise<Id<'sessions'>> {
  const now = Date.now()

  // End current session if one exists
  if (ctx.campaign.currentSessionId) {
    const existingSession = await ctx.db.get(ctx.campaign.currentSessionId)
    if (existingSession) {
      await ctx.db.patch(ctx.campaign.currentSessionId, {
        endedAt: now,
        _updatedTime: now,
        _updatedBy: ctx.user.profile._id,
      })
    }
  }

  const sessionId = await ctx.db.insert('sessions', {
    campaignId: ctx.campaign._id,
    name,
    startedAt: now,
    _updatedTime: now,
    _updatedBy: ctx.user.profile._id,
    _createdBy: ctx.user.profile._id,
  })

  await ctx.db.patch(ctx.campaign._id, {
    currentSessionId: sessionId,
    _updatedTime: now,
    _updatedBy: ctx.user.profile._id,
  })

  return sessionId
}
