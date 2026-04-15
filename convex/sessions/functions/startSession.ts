import type { Id } from '../../_generated/dataModel'
import type { DmMutationCtx } from '../../functions'

export async function startSession(
  ctx: DmMutationCtx,
  { name }: { name?: string },
): Promise<Id<'sessions'>> {
  const campaign = ctx.campaign
  const campaignId = campaign._id
  const now = Date.now()

  const endPrevious = async () => {
    if (campaign.currentSessionId) {
      const existingSession = await ctx.db.get('sessions', campaign.currentSessionId)
      if (existingSession) {
        await ctx.db.patch('sessions', campaign.currentSessionId, {
          endedAt: now,
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
    })

  const [, sessionId] = await Promise.all([endPrevious(), insertNew()])

  await ctx.db.patch('campaigns', campaignId, {
    currentSessionId: sessionId,
  })

  return sessionId
}
