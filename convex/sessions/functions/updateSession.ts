import { getCampaignSessionRow } from './getSession'
import type { Doc } from '../../_generated/dataModel'
import type { DmMutationCtx } from '../../functions'
import type { SessionId } from '@wizard-archive/editor/resources/domain-id'

export async function updateSession(
  ctx: DmMutationCtx,
  { sessionId, name }: { sessionId: SessionId; name?: string },
): Promise<null> {
  const sessionRow = await getCampaignSessionRow(ctx, { sessionId })

  const updates: Partial<Doc<'sessions'>> = {}
  if (name !== undefined) {
    updates.name = name
  }

  if (Object.keys(updates).length > 0) {
    await ctx.db.patch('sessions', sessionRow._id, updates)
  }

  return null
}
