import { describe, expect, it, vi } from 'vite-plus/test'
import { fetchDeviceSessions } from '~/features/auth/utils/device-sessions'

const mockListDeviceSessions = vi.fn()

vi.mock('~/features/auth/utils/auth-client', () => ({
  authClient: {
    multiSession: {
      listDeviceSessions: (...args: Array<unknown>) => mockListDeviceSessions(...args),
    },
  },
}))

describe('fetchDeviceSessions', () => {
  it('throws when device sessions cannot be loaded', async () => {
    mockListDeviceSessions.mockResolvedValue({
      data: null,
      error: new Error('request failed'),
    })

    await expect(fetchDeviceSessions()).rejects.toThrow('Failed to load device sessions')
  })

  it('deduplicates sessions by email after a successful load', async () => {
    mockListDeviceSessions.mockResolvedValue({
      data: [
        {
          session: { token: 'old' },
          user: { id: '1', name: 'First', email: 'player@example.test' },
        },
        {
          session: { token: 'new' },
          user: { id: '1', name: 'First', email: 'player@example.test' },
        },
      ],
      error: null,
    })

    await expect(fetchDeviceSessions()).resolves.toEqual([
      {
        session: { token: 'new' },
        user: { id: '1', name: 'First', email: 'player@example.test' },
      },
    ])
  })
})
