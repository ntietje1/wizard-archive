import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { getCurrentSession as getCurrentSessionHandler } from './sessions'
import { sessionValidator } from './schema'
import type { Session } from './types'

export const getCurrentSession = campaignQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.union(v.null(), sessionValidator),
  handler: async (ctx): Promise<Session | null> => {
    return await getCurrentSessionHandler(ctx)
  },
})

export const getSessionsByCampaign = campaignQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.array(sessionValidator),
  handler: async (ctx): Promise<Array<Session>> => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_campaign_startedAt', (q) =>
        q.eq('campaignId', ctx.campaign._id),
      )
      .order('desc')
      .collect()

    return sessions
  },
})
