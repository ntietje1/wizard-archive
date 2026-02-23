import type { CampaignQueryCtx } from '../functions'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import type { Session } from './types'

export const getCurrentSession = async (
  ctx: CampaignQueryCtx,
): Promise<Session | null> => {
  const campaign = await ctx.db.get(ctx.campaign._id)
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
