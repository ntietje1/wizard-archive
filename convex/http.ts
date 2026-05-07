import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { createAuth } from './auth/component'
import {
  AUTH_BASE_PATH,
  createAuthOptionsHandler,
  createAuthRequestHandler,
  createWellKnownOpenIdConfigurationRedirectHandler,
} from './auth/routes'
import { resend } from './email'

const http = httpRouter()

const authRequestHandler = httpAction(createAuthRequestHandler(createAuth))
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
    return await resend.handleResendEventWebhook(ctx, req)
  }),
})

export default http
