import { v } from 'convex/values'
import { dmMutation } from '../functions'
import { startSession as startSessionFn } from './functions/startSession'
import { endCurrentSession as endCurrentSessionFn } from './functions/endCurrentSession'
import { setCurrentSession as setCurrentSessionFn } from './functions/setCurrentSession'
import { updateSession as updateSessionFn } from './functions/updateSession'
import { DOMAIN_ID_KIND, parseDomainId } from '@wizard-archive/editor/resources/domain-id'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import { sessionIdValidator } from './schema'
import type { SessionId } from '@wizard-archive/editor/resources/domain-id'

function parseSessionId(value: string): SessionId {
  const sessionId = parseDomainId(DOMAIN_ID_KIND.session, value)
  if (!sessionId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Session ID must be a lowercase UUIDv7')
  }
  return sessionId
}

export const startSession = dmMutation({
  args: {
    name: v.optional(v.string()),
  },
  returns: sessionIdValidator,
  handler: async (ctx, args): Promise<SessionId> => {
    return startSessionFn(ctx, { name: args.name })
  },
})

export const endCurrentSession = dmMutation({
  args: {},
  returns: sessionIdValidator,
  handler: async (ctx): Promise<SessionId> => {
    return endCurrentSessionFn(ctx)
  },
})

export const setCurrentSession = dmMutation({
  args: {
    sessionId: sessionIdValidator,
  },
  returns: sessionIdValidator,
  handler: async (ctx, args): Promise<SessionId> => {
    return setCurrentSessionFn(ctx, { sessionId: parseSessionId(args.sessionId) })
  },
})

export const updateSession = dmMutation({
  args: {
    sessionId: sessionIdValidator,
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    return updateSessionFn(ctx, {
      sessionId: parseSessionId(args.sessionId),
      name: args.name,
    })
  },
})
