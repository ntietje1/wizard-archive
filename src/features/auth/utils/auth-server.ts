import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'
import { ERROR_CODE, isClientError } from 'shared/errors/client'
import { getConvexAuthProxyTarget } from './auth-proxy'
import type { ConvexAuthProxyTarget } from './auth-proxy'

type AuthServer = ReturnType<typeof convexBetterAuthReactStart>

let auth: AuthServer | null = null

function getRequiredAuthEnv() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL
  const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL

  if (!convexUrl || !convexSiteUrl) {
    throw new Error(
      'Missing required environment variables: VITE_CONVEX_URL and VITE_CONVEX_SITE_URL',
    )
  }

  return { convexUrl, convexSiteUrl }
}

function getAuth() {
  auth ??= convexBetterAuthReactStart({
    ...getRequiredAuthEnv(),
    jwtCache: {
      enabled: true,
      expirationToleranceSeconds: 60,
      isAuthError: (error) => isClientError(error, ERROR_CODE.NOT_AUTHENTICATED),
    },
  })

  return auth
}

export const handler = async (request: Request) => {
  try {
    const { convexSiteUrl } = getRequiredAuthEnv()
    const target: ConvexAuthProxyTarget = getConvexAuthProxyTarget(request, convexSiteUrl)
    const body = await getReplayableRequestBody(request)

    return await fetchAuthProxyTarget(target, request.method, body)
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

async function fetchAuthProxyTarget(
  target: ConvexAuthProxyTarget,
  method: string,
  body: ArrayBuffer | null,
): Promise<Response> {
  try {
    return await fetch(target.url, createProxyRequestInit(method, target.headers, body))
  } catch (error) {
    if (!isRetryableFetchError(error)) {
      throw error
    }
    return await fetch(target.url, createProxyRequestInit(method, target.headers, body))
  }
}

function createProxyRequestInit(
  method: string,
  headers: Headers,
  body: ArrayBuffer | null,
): RequestInit {
  return {
    method,
    headers,
    redirect: 'manual',
    body: body?.slice(0),
  }
}

async function getReplayableRequestBody(request: Request): Promise<ArrayBuffer | null> {
  if (request.method === 'GET' || request.method === 'HEAD' || request.body === null) {
    return null
  }

  return await request.arrayBuffer()
}

function isRetryableFetchError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'retryable' in error && error.retryable === true
  )
}

export const getToken: AuthServer['getToken'] = async () => {
  return await getAuth().getToken()
}
