import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { SignUpForm } from '~/features/auth/components/sign-up-form'

const mockSignUpEmail = vi.fn()
const mockSignInSocial = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
    createElement('a', { href: props.to, ...props }, children),
}))

vi.mock('~/features/auth/utils/auth-client', () => ({
  authClient: {
    signUp: {
      email: (...args: Array<unknown>) => mockSignUpEmail(...args),
    },
    signIn: {
      social: (...args: Array<unknown>) => mockSignInSocial(...args),
    },
  },
}))

describe('SignUpForm', () => {
  beforeEach(() => {
    mockSignUpEmail.mockReset()
    mockSignInSocial.mockReset()
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

  it('shows Terms and Privacy links for email and OAuth signup', () => {
    render(<SignUpForm />)

    const termsLinks = screen.getAllByRole('link', { name: 'Terms of Service' })
    const privacyLinks = screen.getAllByRole('link', { name: 'Privacy Policy' })

    expect(termsLinks).toHaveLength(2)
    expect(privacyLinks).toHaveLength(2)
    for (const link of termsLinks) expect(link).toHaveAttribute('href', '/terms')
    for (const link of privacyLinks) expect(link).toHaveAttribute('href', '/privacy')
  })

  it('requires Terms acceptance before email signup can submit', async () => {
    mockSignUpEmail.mockImplementation((_credentials, options) => {
      options.onSuccess({ data: {} })
      return Promise.resolve()
    })

    const user = userEvent.setup()
    render(<SignUpForm />)

    const submit = screen.getByRole('button', { name: /create account/i })

    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('checkbox'))
    await user.click(submit)

    await waitFor(() => {
      expect(mockSignUpEmail).toHaveBeenCalledWith(
        {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test',
          callbackURL: '/campaigns',
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      )
    })
  })

  it('starts Google OAuth sign-in with the redirect target', async () => {
    mockSignInSocial.mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<SignUpForm redirectTo="/welcome" />)

    await user.click(screen.getByRole('button', { name: /continue with google/i }))

    expect(mockSignInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/welcome',
    })
  })
})
