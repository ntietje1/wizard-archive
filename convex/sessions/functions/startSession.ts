import { requireDmRole } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function startSession(
  ctx: AuthMutationCtx,
  { name, campaignId }: { name?: string; campaignId: Id<'campaigns'> },
): Promise<Id<'sessions'>> {
  const { campaign } = await requireDmRole(ctx, campaignId)
  const now = Date.now()

  const endPrevious = async () => {
    if (campaign.currentSessionId) {
      const existingSession = await ctx.db.get("sessions", campaign.currentSessionId)
      if (existingSession) {
        await ctx.db.patch("sessions", campaign.currentSessionId, {
          endedAt: now,
          updatedTime: now,
          updatedBy: ctx.user.profile._id,
        })
      }
    }
  }

  const insertNew = () =>
    ctx.db.insert('sessions', {
      campaignId,
      name: name ?? null,
      startedAt: now,
      endedAt: null,
      deletionTime: null,
      deletedBy: null,
      updatedTime: null,
      updatedBy: null,
      createdBy: ctx.user.profile._id,
    })

  const [, sessionId] = await Promise.all([endPrevious(), insertNew()])

  await ctx.db.patch("campaigns", campaignId, {
    currentSessionId: sessionId,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })

  return sessionId
}
