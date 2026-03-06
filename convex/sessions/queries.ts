import { v } from 'convex/values'
import { authQuery } from '../functions'
import { sessionValidator } from './schema'
import { getCurrentSession as getCurrentSessionFn } from './functions/getCurrentSession'
import { getSessionsByCampaign as getSessionsByCampaignFn } from './functions/getSessionsByCampaign'
import type { Session } from './types'

export const getCurrentSession = authQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.union(v.null(), sessionValidator),
  handler: async (ctx, args): Promise<Session | null> => {
    return getCurrentSessionFn(ctx, { campaignId: args.campaignId })
  },
})

export const getSessionsByCampaign = authQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.array(sessionValidator),
  handler: async (ctx, args): Promise<Array<Session>> => {
    return getSessionsByCampaignFn(ctx, { campaignId: args.campaignId })
  },
})
