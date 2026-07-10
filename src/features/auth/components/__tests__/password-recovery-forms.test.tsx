import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { ForgotPasswordForm } from '~/features/auth/components/forgot-password-form'
import { ResetPasswordForm } from '~/features/auth/components/reset-password-form'

const mockRequestPasswordReset = vi.fn()
const mockResetPassword = vi.fn()
let searchParams: Record<string, string | undefined> = {}

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => searchParams,
  Link: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
    createElement('a', { href: props.to, ...props }, children),
}))

vi.mock('~/features/auth/utils/auth-client', () => ({
  authClient: {
    requestPasswordReset: (...args: Array<unknown>) => mockRequestPasswordReset(...args),
    resetPassword: (...args: Array<unknown>) => mockResetPassword(...args),
  },
}))

describe('password recovery forms', () => {
  beforeEach(() => {
    searchParams = {}
    mockRequestPasswordReset.mockReset()
    mockResetPassword.mockReset()
  })

  it('requests a password reset and shows the neutral email confirmation state', async () => {
    mockRequestPasswordReset.mockImplementation((_payload, options) => {
      options.onSuccess()
      return Promise.resolve()
    })

    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument()
    })
    expect(mockRequestPasswordReset).toHaveBeenCalledWith(
      { email: 'test@example.com', redirectTo: '/reset-password' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    )
  })

  it('shows the invalid reset-link state when no token is present', () => {
    render(<ResetPasswordForm />)

    expect(screen.getByText('Invalid link')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('validates matching reset passwords before calling auth', async () => {
    searchParams = { token: 'reset-token' }

    const user = userEvent.setup()
    render(<ResetPasswordForm />)

    await user.type(screen.getByLabelText('New password'), 'password123')
    await user.type(screen.getByLabelText('Confirm password'), 'password456')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match')
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('resets the password and shows the success state', async () => {
    searchParams = { token: 'reset-token' }
    mockResetPassword.mockImplementation((_payload, options) => {
      options.onSuccess()
      return Promise.resolve()
    })

    const user = userEvent.setup()
    render(<ResetPasswordForm />)

    await user.type(screen.getByLabelText('New password'), 'password123')
    await user.type(screen.getByLabelText('Confirm password'), 'password123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText('Password reset')).toBeInTheDocument()
    })
    expect(mockResetPassword).toHaveBeenCalledWith(
      { newPassword: 'password123', token: 'reset-token' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
    expect(screen.getByRole('link', { name: 'Sign in with your new password' })).toHaveAttribute(
      'href',
      '/sign-in',
    )
  })
})
