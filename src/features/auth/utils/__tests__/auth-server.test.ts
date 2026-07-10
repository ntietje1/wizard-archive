import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { handler } from '../auth-server'

describe('auth server proxy handler', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CONVEX_URL', 'https://example.convex.cloud')
    vi.stubEnv('VITE_CONVEX_SITE_URL', 'https://example.convex.site')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('retries a retryable auth proxy network failure with the same request body', async () => {
    const retryableError = Object.assign(new Error('Network connection lost'), {
      remote: true,
      retryable: true,
    })
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const request = new Request('https://app.example.com/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'person@example.com', password: 'correct horse' }),
    })

    const response = await handler(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstInit = fetchMock.mock.calls[0]?.[1]
    const secondInit = fetchMock.mock.calls[1]?.[1]
    expect(await requestBodyText(firstInit)).toBe(
      '{"email":"person@example.com","password":"correct horse"}',
    )
    expect(await requestBodyText(secondInit)).toBe(
      '{"email":"person@example.com","password":"correct horse"}',
    )
  })
})

async function requestBodyText(init: RequestInit | undefined): Promise<string> {
  expect(init?.body).toBeInstanceOf(ArrayBuffer)
  return await new Response(init?.body).text()
}
