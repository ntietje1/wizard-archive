import { v } from 'convex/values'
import { dmMutation } from '../functions'
import { startSession as startSessionFn } from './functions/startSession'
import { endCurrentSession as endCurrentSessionFn } from './functions/endCurrentSession'
import { setCurrentSession as setCurrentSessionFn } from './functions/setCurrentSession'
import { updateSession as updateSessionFn } from './functions/updateSession'
import type { Id } from '../_generated/dataModel'

export const startSession = dmMutation({
  args: {
    name: v.optional(v.string()),
  },
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
    return startSessionFn(ctx, { name: args.name })
  },
})

export const endCurrentSession = dmMutation({
  args: {},
  returns: v.id('sessions'),
  handler: async (ctx): Promise<Id<'sessions'>> => {
    return endCurrentSessionFn(ctx)
  },
})

export const setCurrentSession = dmMutation({
  args: {
    sessionId: v.id('sessions'),
  },
  returns: v.id('sessions'),
  handler: async (ctx, args): Promise<Id<'sessions'>> => {
    return setCurrentSessionFn(ctx, { sessionId: args.sessionId })
  },
})

export const updateSession = dmMutation({
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
