import { describe, expect, it } from 'vite-plus/test'
import { getConvexAuthProxyTarget } from '../auth-proxy'

describe('getConvexAuthProxyTarget', () => {
  it('forwards the original app host to Convex auth', () => {
    const request = new Request('https://app.example.com/api/auth/sign-in/social?provider=google', {
      method: 'POST',
    })

    const target = getConvexAuthProxyTarget(request, 'https://example.convex.site')

    expect(target.url).toBe('https://example.convex.site/api/auth/sign-in/social?provider=google')
    expect(target.headers.get('host')).toBe('example.convex.site')
    expect(target.headers.get('x-forwarded-host')).toBe('app.example.com')
    expect(target.headers.get('x-forwarded-proto')).toBe('https')
  })

  it('overwrites spoofed forwarded host headers', () => {
    const request = new Request('https://app.example.com/api/auth/get-session', {
      headers: {
        'x-forwarded-host': 'other.example.com',
        'x-forwarded-proto': 'http',
      },
    })

    const target = getConvexAuthProxyTarget(request, 'https://example.convex.site')

    expect(target.url).toBe('https://example.convex.site/api/auth/get-session')
    expect(target.headers.get('x-forwarded-host')).toBe('app.example.com')
    expect(target.headers.get('x-forwarded-proto')).toBe('https')
  })

  it('derives the forwarded protocol from an HTTP request URL', () => {
    const request = new Request('http://app.example.com/api/auth/get-session')

    const target = getConvexAuthProxyTarget(request, 'https://example.convex.site')

    expect(target.headers.get('x-forwarded-proto')).toBe('http')
  })

  it('normalizes trailing slashes in the Convex site URL', () => {
    const request = new Request('https://app.example.com/api/auth/get-session')

    const target = getConvexAuthProxyTarget(request, 'https://example.convex.site/')

    expect(target.url).toBe('https://example.convex.site/api/auth/get-session')
  })
})
