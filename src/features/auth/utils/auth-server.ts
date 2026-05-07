import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'
import { ERROR_CODE, isClientError } from 'convex/errors'
import { getConvexAuthProxyTarget } from './auth-proxy'
import type { ConvexAuthProxyTarget } from './auth-proxy'

const convexUrl = import.meta.env.VITE_CONVEX_URL
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL

if (!convexUrl || !convexSiteUrl) {
  throw new Error(
    'Missing required environment variables: VITE_CONVEX_URL and VITE_CONVEX_SITE_URL',
  )
}

const auth = convexBetterAuthReactStart({
  convexUrl,
  convexSiteUrl,
  jwtCache: {
    enabled: true,
    expirationToleranceSeconds: 60,
    isAuthError: (error) => isClientError(error, ERROR_CODE.NOT_AUTHENTICATED),
  },
})

export const handler = async (request: Request) => {
  try {
    const target: ConvexAuthProxyTarget = getConvexAuthProxyTarget(request, convexSiteUrl)
    const init = {
      method: request.method,
      headers: target.headers,
      redirect: 'manual',
      body: request.body,
      duplex: 'half',
    } satisfies RequestInit & { duplex: 'half' }

    return await fetch(target.url, init)
  } catch (error) {
    console.error('Auth proxy request failed', error)
    return new Response(JSON.stringify({ error: 'AUTH_PROXY_REQUEST_FAILED' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
}

export const { getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } = auth
