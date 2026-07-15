import { describe, expect, it } from 'vite-plus/test'
import { PUBLIC_AUTH_ORIGIN_HEADER, getPublicAuthRequest } from '../routes'

describe('getPublicAuthRequest', () => {
  it('rewrites proxied Convex auth requests to the public app origin', () => {
    const request = new Request(
      'https://example.convex.site/api/auth/sign-in/social?provider=google',
      {
        method: 'POST',
        headers: {
          [PUBLIC_AUTH_ORIGIN_HEADER]: 'https://candidate.example.com',
        },
      },
    )

    const publicRequest = getPublicAuthRequest(request)

    expect(publicRequest.url).toBe(
      'https://candidate.example.com/api/auth/sign-in/social?provider=google',
    )
    expect(publicRequest.headers.get('host')).toBe('candidate.example.com')
    expect(publicRequest.headers.get('x-forwarded-host')).toBe('candidate.example.com')
    expect(publicRequest.headers.get('x-forwarded-proto')).toBe('https')
  })

  it('does not read Request.redirect when rewriting the request', () => {
    const request = new Request('https://example.convex.site/api/auth/get-session', {
      headers: {
        [PUBLIC_AUTH_ORIGIN_HEADER]: 'https://candidate.example.com',
      },
    })
    Object.defineProperty(request, 'redirect', {
      get: () => {
        throw new Error('redirect is not implemented')
      },
    })

    expect(() => getPublicAuthRequest(request)).not.toThrow()
  })

  it('leaves requests unchanged when the public origin header is invalid', () => {
    const request = new Request('https://example.convex.site/api/auth/get-session', {
      headers: {
        [PUBLIC_AUTH_ORIGIN_HEADER]: 'javascript:alert(1)',
      },
    })

    expect(getPublicAuthRequest(request)).toBe(request)
  })
})
