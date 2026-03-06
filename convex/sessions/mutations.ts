import { v } from 'convex/values'
import { authMutation } from '../functions'
import { startSession as startSessionFn } from './functions/startSession'
import { endCurrentSession as endCurrentSessionFn } from './functions/endCurrentSession'
import { setCurrentSession as setCurrentSessionFn } from './functions/setCurrentSession'
import { updateSession as updateSessionFn } from './functions/updateSession'
import type { Id } from '../_generated/dataModel'

export const startSession = authMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.optional(v.string()),
  },
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
    return startSessionFn(ctx, { name: args.name, campaignId: args.campaignId })
  },
})

export const endCurrentSession = authMutation({
  args: { campaignId: v.id('campaigns') },
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
    return endCurrentSessionFn(ctx, { campaignId: args.campaignId })
  },
})

export const setCurrentSession = authMutation({
  args: {
    sessionId: v.id('sessions'),
  },
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
    return setCurrentSessionFn(ctx, { sessionId: args.sessionId })
  },
})

export const updateSession = authMutation({
  args: {
    sessionId: v.id('sessions'),
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    return updateSessionFn(ctx, {
      sessionId: args.sessionId,
      name: args.name,
    })
  },
})
