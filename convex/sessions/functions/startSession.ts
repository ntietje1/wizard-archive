import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { SessionId } from '@wizard-archive/editor/resources/domain-id'
import type { DmMutationCtx } from '../../functions'

export async function startSession(
  ctx: DmMutationCtx,
  { name }: { name?: string },
): Promise<SessionId> {
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

  const sessionId = generateDomainId(DOMAIN_ID_KIND.session)
  const insertNew = () =>
    ctx.db.insert('sessions', {
      sessionUuid: sessionId,
      campaignId,
      name: name ?? null,
      startedAt: now,
      endedAt: null,
    })

  const [, sessionRowId] = await Promise.all([endPrevious(), insertNew()])

  await ctx.db.patch('campaigns', campaignId, {
    currentSessionId: sessionRowId,
  })

  return sessionId
}
