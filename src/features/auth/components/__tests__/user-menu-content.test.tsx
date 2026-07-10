import { createElement } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ReactNode } from 'react'
import { UserMenuContent } from '~/features/auth/components/user-menu-content'
import { authClient } from '~/features/auth/utils/auth-client'

const mockRetry = vi.fn()
const mockUseDeviceSessions = vi.fn()
const mockUseAuthQuery = vi.fn()
const mockNavigate = vi.fn()
const mockFetchDeviceSessions = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}))

vi.mock('~/features/auth/hooks/useAuthSessions', () => ({
  useDeviceSessions: () => mockUseDeviceSessions(),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => mockUseAuthQuery(),
}))

vi.mock('~/features/settings/hooks/settings-store', () => ({
  useSettingsStore: () => vi.fn(),
}))

vi.mock('~/features/auth/utils/auth-client', () => ({
  authClient: {
    multiSession: {
      setActive: vi.fn(),
      revoke: vi.fn(),
    },
    signOut: vi.fn(),
  },
}))

vi.mock('~/features/auth/utils/device-sessions', () => ({
  fetchDeviceSessions: () => mockFetchDeviceSessions(),
}))

vi.mock('~/features/auth/components/account-switcher', () => ({
  AccountRow: ({ name, subtitle }: { name?: string | null; subtitle: string }) =>
    createElement('div', null, `${name ?? ''} ${subtitle}`),
  AccountSwitcher: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-testid': 'account-switcher' }, children),
}))

describe('UserMenuContent', () => {
  beforeEach(() => {
    mockRetry.mockReset()
    mockNavigate.mockReset()
    mockFetchDeviceSessions.mockReset()
    vi.mocked(authClient.multiSession.revoke).mockReset()
    vi.mocked(authClient.signOut).mockReset()
    mockUseAuthQuery.mockReturnValue({
      data: {
        name: 'Mina',
        username: 'mina',
        email: 'mina@example.test',
        imageUrl: null,
      },
    })
    mockUseDeviceSessions.mockReturnValue({
      allSessions: [],
      isError: true,
      retry: mockRetry,
      refresh: vi.fn(),
      currentToken: 'current',
    })
  })

  it('renders a retryable account-switcher failure', () => {
    render(<UserMenuContent onClose={vi.fn()} />)

    expect(screen.getByText('Could not load other accounts.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(mockRetry).toHaveBeenCalled()
  })

  it('falls back to the sign-in form when account lookup fails after sign-out succeeds', async () => {
    vi.mocked(authClient.multiSession.revoke).mockResolvedValue(undefined)
    mockFetchDeviceSessions.mockRejectedValue(new Error('lookup failed'))

    render(<UserMenuContent onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/sign-in',
        search: {},
      })
    })
  })
})
