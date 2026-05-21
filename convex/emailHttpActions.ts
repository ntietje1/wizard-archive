'use node'

import { internalAction } from './_generated/server'
import {
  deserializeHttpRequest,
  serializeHttpResponse,
  serializedHttpRequestValidator,
  serializedHttpResponseValidator,
} from './httpBridge'
import { resend } from './email'

export const handleResendWebhook = internalAction({
  args: {
    request: serializedHttpRequestValidator,
  },
  returns: serializedHttpResponseValidator,
  handler: async (ctx, args) => {
    const response = await resend.handleResendEventWebhook(
      ctx,
      deserializeHttpRequest(args.request),
    )
    return await serializeHttpResponse(response)
  },
})
