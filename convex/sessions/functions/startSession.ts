import type { Id } from '../../_generated/dataModel'
import type { DmMutationCtx } from '../../functions'

export async function startSession(
  ctx: DmMutationCtx,
  { name }: { name?: string },
): Promise<Id<'sessions'>> {
  const campaign = ctx.campaign
  const campaignId = campaign._id
  const userId = ctx.membership.userId
  const now = Date.now()

  const endPrevious = async () => {
    if (campaign.currentSessionId) {
      const existingSession = await ctx.db.get('sessions', campaign.currentSessionId)
      if (existingSession) {
        await ctx.db.patch('sessions', campaign.currentSessionId, {
          endedAt: now,
          updatedTime: now,
          updatedBy: userId,
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
      createdBy: userId,
    })

  const [, sessionId] = await Promise.all([endPrevious(), insertNew()])

  await ctx.db.patch('campaigns', campaignId, {
    currentSessionId: sessionId,
    updatedTime: now,
    updatedBy: userId,
  })

  return sessionId
}
