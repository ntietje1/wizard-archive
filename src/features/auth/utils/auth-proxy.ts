export type ConvexAuthProxyTarget = {
  url: string
  headers: Headers
}

const PUBLIC_AUTH_ORIGIN_HEADER = 'x-wizard-archive-auth-origin'

export function getConvexAuthProxyTarget(
  request: Request,
  convexSiteUrl: string,
): ConvexAuthProxyTarget {
  const requestUrl = new URL(request.url)
  const convexUrl = new URL(convexSiteUrl)
  const targetUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, convexUrl.origin)
  const headers = new Headers(request.headers)

  headers.set('Accept', 'application/json')
  headers.set(PUBLIC_AUTH_ORIGIN_HEADER, requestUrl.origin)
  headers.set('x-forwarded-host', requestUrl.host)
  headers.set('x-forwarded-proto', requestUrl.protocol.replace(':', ''))
  headers.set('host', convexUrl.host)

  return {
    url: targetUrl.toString(),
    headers,
  }
}
