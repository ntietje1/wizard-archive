import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { getCurrentSession as getCurrentSessionHandler } from './sessions'
import { sessionValidator } from './schema'
import type { Session } from './types'

export const getCurrentSession = campaignQuery({
  returns: v.union(v.null(), sessionValidator),
  handler: async (ctx, args): Promise<Session | null> => {
    return await getCurrentSessionHandler(ctx, args.campaignId)
  },
})

export const getSessionsByCampaign = campaignQuery({
  returns: v.array(sessionValidator),
  handler: async (ctx, args): Promise<Array<Session>> => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_campaign_startedAt', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .order('desc')
      .collect()

    return sessions
  },
})
