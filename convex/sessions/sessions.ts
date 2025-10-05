import { Session } from './types'
import { Id } from '../_generated/dataModel'
import { MutationCtx, QueryCtx } from '../_generated/server'

export const combineSessionAndTag = (
  session: { _id: Id<'sessions'> },
  tag: { _id: Id<'tags'> },
  category?: { _id: Id<'tagCategories'> },
): Session => {
  return {
    ...session,
    ...tag,
    category,
    tagId: tag._id,
    sessionId: session._id,
  } as Session
}

export const getCurrentSession = async (
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
): Promise<Session | null> => {
  const currentSessionId = (await ctx.db.get(campaignId))?.currentSessionId
  if (!currentSessionId) {
    return null
  }
  return getSession(ctx, currentSessionId)
}

export const getSession = async (
  ctx: QueryCtx,
  sessionId: Id<'sessions'>,
): Promise<Session | null> => {
  const session = await ctx.db.get(sessionId)
  if (!session) {
    return null
  }
  const tag = await ctx.db.get(session.tagId)
  if (!tag) {
    return null
  }
  const category = await ctx.db.get(tag.categoryId)
  if (!category) {
    return null
  }
  return combineSessionAndTag(session, tag, category)
}

export const endCurrentSession = async (
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
): Promise<Id<'sessions'>> => {
  const currentSession = await getCurrentSession(ctx, campaignId)
  if (!currentSession) {
    throw new Error('Session not found')
  }
  const session = await ctx.db
    .query('sessions')
    .withIndex('by_campaign_tag_endedAt', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('tagId', currentSession.tagId)
        .eq('endedAt', undefined),
    )
    .unique()
  if (!session) {
    throw new Error('Session not found')
  }
  await ctx.db.patch(session._id, { endedAt: Date.now() })
  await ctx.db.patch(campaignId, { currentSessionId: undefined })
  return session._id
}
