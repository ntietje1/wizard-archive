import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { Session } from '../types'

export async function getSession(
  ctx: QueryCtx,
  sessionId: Id<'sessions'>,
): Promise<Session | null> {
  return await ctx.db.get(sessionId)
}
