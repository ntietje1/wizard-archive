'use node'

import { internalAction } from '../_generated/server'
import {
  deserializeHttpRequest,
  serializeHttpResponse,
  serializedHttpRequestValidator,
  serializedHttpResponseValidator,
} from '../httpBridge'
import { createAuthRequestHandler } from './routes'
import { createAuth } from './_createAuth'

export const handleAuthRequest = internalAction({
  args: {
    request: serializedHttpRequestValidator,
  },
  returns: serializedHttpResponseValidator,
  handler: async (ctx, args) => {
    const request = deserializeHttpRequest(args.request)
    const response = await createAuthRequestHandler(createAuth)(ctx, request)
    return await serializeHttpResponse(response)
  },
})
