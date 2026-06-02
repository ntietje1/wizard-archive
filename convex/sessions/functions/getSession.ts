import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { Session } from '../../../shared/sessions/types'

export async function getSession(
  ctx: QueryCtx,
  { sessionId }: { sessionId: Id<'sessions'> },
): Promise<Session | null> {
  return await ctx.db.get('sessions', sessionId)
}
