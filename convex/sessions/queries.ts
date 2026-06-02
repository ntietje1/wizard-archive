import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { sessionValidator } from './schema'
import { getCurrentSession as getCurrentSessionFn } from './functions/getCurrentSession'
import { getSessionsByCampaign as getSessionsByCampaignFn } from './functions/getSessionsByCampaign'
import type { Session } from '../../shared/sessions/types'

export const getCurrentSession = campaignQuery({
  args: {},
  returns: v.union(v.null(), sessionValidator),
  handler: async (ctx): Promise<Session | null> => {
    return getCurrentSessionFn(ctx)
  },
})

export const getSessionsByCampaign = campaignQuery({
  args: {},
  returns: v.array(sessionValidator),
  handler: async (ctx): Promise<Array<Session>> => {
    return getSessionsByCampaignFn(ctx)
  },
})
