import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { SignInPage } from '~/features/auth/pages/sign-in-page'

const mockNavigate = vi.fn()
const mockRetry = vi.fn()
const mockUseDeviceSessions = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('~/features/auth/hooks/useAuthSessions', () => ({
  useDeviceSessions: () => mockUseDeviceSessions(),
}))

vi.mock('~/features/auth/components/auth-page-layout', () => ({
  AuthPageLayout: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

vi.mock('~/features/auth/components/account-picker', () => ({
  AccountPicker: () => createElement('div', { 'data-testid': 'account-picker' }),
}))

vi.mock('~/features/auth/components/sign-in-form', () => ({
  SignInForm: () => createElement('div', { 'data-testid': 'sign-in-form' }),
}))

describe('SignInPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockRetry.mockReset()
    mockUseDeviceSessions.mockReturnValue({
      allSessions: [],
      isLoaded: false,
      isError: false,
      retry: mockRetry,
    })
  })

  it('renders a retryable account load failure for picker view', () => {
    mockUseDeviceSessions.mockReturnValue({
      allSessions: [],
      isLoaded: false,
      isError: true,
      retry: mockRetry,
    })

    render(<SignInPage view="picker" />)

    expect(screen.getByRole('heading', { name: 'Could Not Load Accounts' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(mockRetry).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/sign-in',
      search: { view: 'form' },
    })
  })
})
