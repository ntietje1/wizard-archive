import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { Session } from '../../../shared/sessions/types'

export function toSession(session: Doc<'sessions'>): Session {
  const { _id, _creationTime, ...fields } = session
  return {
    ...fields,
    id: _id,
    createdAt: _creationTime,
  }
}

export async function getSession(
  ctx: QueryCtx,
  { sessionId }: { sessionId: Id<'sessions'> },
): Promise<Session | null> {
  const session = await ctx.db.get('sessions', sessionId)
  return session ? toSession(session) : null
}
