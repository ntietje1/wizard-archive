import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignInForm } from '~/features/auth/components/sign-in-form'

const mockSignInEmail = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  useSearch: () => ({}),
  useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  Link: ({ children, ...props }: Record<string, unknown>) => {
    const { createElement } = require('react')
    return createElement('a', { href: props.to, ...props }, children)
  },
  useRouter: () => ({ navigate: vi.fn() }),
}))

vi.mock('~/features/auth/utils/auth-client', () => ({
  authClient: {
    signIn: {
      email: (...args: Array<unknown>) => mockSignInEmail(...args),
      social: vi.fn(),
    },
  },
}))

describe('SignInForm', () => {
  beforeEach(() => {
    mockSignInEmail.mockReset()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders credentials view with email, password, and sign-in button', () => {
    render(<SignInForm />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders sign-up link', () => {
    render(<SignInForm />)

    expect(screen.getByText('Sign up')).toBeInTheDocument()
    expect(screen.getByText('Sign up').closest('a')).toHaveAttribute(
      'href',
      '/sign-up',
    )
  })

  it('renders Google OAuth button', () => {
    render(<SignInForm />)

    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument()
  })

  it('calls authClient.signIn.email on form submit', async () => {
    mockSignInEmail.mockImplementation((_creds, opts) => {
      opts.onSuccess({ data: {} })
    })

    const user = userEvent.setup()
    render(<SignInForm />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockSignInEmail).toHaveBeenCalledWith(
      { email: 'test@example.com', password: 'password123' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
  })

  it('shows error on failed sign-in', async () => {
    mockSignInEmail.mockImplementation((_creds, opts) => {
      opts.onError({ error: { message: 'Invalid email or password' } })
    })

    const user = userEvent.setup()
    render(<SignInForm />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })
  })

  it('transitions to 2FA view when twoFactorRedirect is returned', async () => {
    mockSignInEmail.mockImplementation((_creds, opts) => {
      opts.onSuccess({ data: { twoFactorRedirect: true } })
    })

    const user = userEvent.setup()
    render(<SignInForm />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    })
  })

  it('transitions to email-not-verified view on EMAIL_NOT_VERIFIED error', async () => {
    mockSignInEmail.mockImplementation((_creds, opts) => {
      opts.onError({ error: { code: 'EMAIL_NOT_VERIFIED', message: '' } })
    })

    const user = userEvent.setup()
    render(<SignInForm />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    })
  })
})
