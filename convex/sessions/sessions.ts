import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Session } from './types'

export const getCurrentSession = async (
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
): Promise<Session | null> => {
  const campaign = await ctx.db.get(campaignId)
  if (!campaign?.currentSessionId) {
    return null
  }
  return getSession(ctx, campaign.currentSessionId)
}

export const getSession = async (
  ctx: QueryCtx,
  sessionId: Id<'sessions'>,
): Promise<Session | null> => {
  const session = await ctx.db.get(sessionId)
  if (!session) {
    return null
  }
  return session
}

export const startSession = async (
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  name?: string,
): Promise<Id<'sessions'>> => {
  const campaign = await ctx.db.get(campaignId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  // End current session if one exists
  if (campaign.currentSessionId) {
    const existingSession = await ctx.db.get(campaign.currentSessionId)
    if (existingSession) {
      await ctx.db.patch(campaign.currentSessionId, {
        endedAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  }

  const sessionId = await ctx.db.insert('sessions', {
    campaignId,
    name,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  })

  await ctx.db.patch(campaignId, { currentSessionId: sessionId })
  return sessionId
}

export const endCurrentSession = async (
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
): Promise<Id<'sessions'>> => {
  const currentSession = await getCurrentSession(ctx, campaignId)
  if (!currentSession) {
    throw new Error('No active session')
  }

  await ctx.db.patch(currentSession._id, {
    endedAt: Date.now(),
    updatedAt: Date.now(),
  })
  await ctx.db.patch(campaignId, { currentSessionId: undefined })
  return currentSession._id
}

export const getSessionsByCampaign = async (
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
): Promise<Array<Session>> => {
  const sessions = await ctx.db
    .query('sessions')
    .withIndex('by_campaign_startedAt', (q) => q.eq('campaignId', campaignId))
    .order('desc')
    .collect()

  return sessions
}
