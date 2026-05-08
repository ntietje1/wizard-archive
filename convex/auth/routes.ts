import type { ActionCtx } from '../_generated/server'

export const AUTH_BASE_PATH = '/api/auth'
export const PUBLIC_AUTH_ORIGIN_HEADER = 'x-wizard-archive-auth-origin'

type AuthRouteHandler = {
  handler: (request: Request) => Promise<Response>
}

type CreateAuthRouteHandler = (ctx: ActionCtx) => AuthRouteHandler

export function createAuthRequestHandler(createAuth: CreateAuthRouteHandler) {
  return async (ctx: ActionCtx, request: Request): Promise<Response> => {
    try {
      return await createAuth(ctx).handler(getPublicAuthRequest(request))
    } catch (error) {
      console.error('Auth route failed', error)
      return jsonErrorResponse('AUTH_ROUTE_FAILED', 500)
    }
  }
}

export function getPublicAuthRequest(request: Request): Request {
  const publicOrigin = getPublicAuthOrigin(request)

  if (!publicOrigin) {
    return request
  }

  const requestUrl = new URL(request.url)
  const publicUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, publicOrigin)
  const headers = new Headers(request.headers)
  headers.set('host', publicUrl.host)
  headers.set('x-forwarded-host', publicUrl.host)
  headers.set('x-forwarded-proto', publicUrl.protocol.replace(':', ''))

  const init = {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: request.redirect,
    duplex: 'half',
  } satisfies RequestInit & { duplex: 'half' }

  return new Request(publicUrl, init)
}

export function createAuthOptionsHandler() {
  return (_ctx: ActionCtx, request: Request): Response => {
    const origin = request.headers.get('origin')

    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, Better-Auth-Cookie, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Origin': origin ?? '*',
        Vary: 'Origin',
      },
    })
  }
}

export function createWellKnownOpenIdConfigurationRedirectHandler(basePath = AUTH_BASE_PATH) {
  return (): Response => {
    const convexSiteUrl = process.env.CONVEX_SITE_URL?.trim()

    if (!convexSiteUrl) {
      return jsonErrorResponse('MISSING_CONVEX_SITE_URL', 500)
    }

    const redirectUrl = new URL(
      `${normalizeBasePath(basePath)}/convex/.well-known/openid-configuration`,
      ensureTrailingSlash(convexSiteUrl),
    )

    return Response.redirect(redirectUrl.toString())
  }
}

function jsonErrorResponse(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function normalizeBasePath(basePath: string): string {
  return basePath.startsWith('/') ? basePath : `/${basePath}`
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

function getPublicAuthOrigin(request: Request): string | null {
  return parseOrigin(request.headers.get(PUBLIC_AUTH_ORIGIN_HEADER))
}

function parseOrigin(value: string | null): string | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}
