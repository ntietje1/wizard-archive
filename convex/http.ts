import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import {
  AUTH_BASE_PATH,
  createAuthOptionsHandler,
  createWellKnownOpenIdConfigurationRedirectHandler,
} from './auth/routes'
import { deserializeHttpResponse, serializeHttpRequest } from './httpBridge'

const http = httpRouter()

const authRequestHandler = httpAction(async (ctx, request) => {
  const response = await ctx.runAction(internal.auth.httpActions.handleAuthRequest, {
    request: await serializeHttpRequest(request),
  })

  return deserializeHttpResponse(response)
})

const authOptionsHandler = createAuthOptionsHandler()
const wellKnownOpenIdConfigurationRedirectHandler =
  createWellKnownOpenIdConfigurationRedirectHandler(AUTH_BASE_PATH)

if (!http.lookup('/.well-known/openid-configuration', 'GET')) {
  http.route({
    path: '/.well-known/openid-configuration',
    method: 'GET',
    handler: httpAction(async () => {
      return await Promise.resolve(wellKnownOpenIdConfigurationRedirectHandler())
    }),
  })
}

http.route({
  pathPrefix: `${AUTH_BASE_PATH}/`,
  method: 'GET',
  handler: authRequestHandler,
})

http.route({
  pathPrefix: `${AUTH_BASE_PATH}/`,
  method: 'POST',
  handler: authRequestHandler,
})

http.route({
  pathPrefix: `${AUTH_BASE_PATH}/`,
  method: 'OPTIONS',
  handler: httpAction(async (ctx, request) => {
    return await Promise.resolve(authOptionsHandler(ctx, request))
  }),
})

http.route({
  path: '/resend-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const response = await ctx.runAction(internal.emailHttpActions.handleResendWebhook, {
      request: await serializeHttpRequest(req),
    })
    return deserializeHttpResponse(response)
  }),
})

export default http
