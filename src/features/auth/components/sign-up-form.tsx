import { useReducer } from 'react'
import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import {
  AuthEmailField,
  AuthFormShell,
  AuthGoogleButton,
  AuthPasswordField,
  AuthStatusMessage,
} from './auth-form-elements'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { Separator } from '@wizard-archive/ui/shadcn/components/separator'
import { publicSite } from '~/features/landing/content/public-site'

type SignUpFormProps = {
  redirectTo?: string
}

type SocialProvider = 'google'

type SignUpState = {
  email: string
  password: string
  error: string
  isLoading: boolean
  emailSent: boolean
  socialLoading: SocialProvider | null
  termsAccepted: boolean
}

type SignUpAction =
  | { type: 'SET_FIELD'; field: 'email' | 'password'; value: string }
  | { type: 'SUBMIT' }
  | { type: 'EMAIL_SENT' }
  | { type: 'ERROR'; error: string }
  | { type: 'DONE' }
  | { type: 'SOCIAL_START'; provider: SocialProvider }
  | { type: 'SOCIAL_ERROR'; error: string }
  | { type: 'SET_TERMS'; accepted: boolean }

function signUpReducer(state: SignUpState, action: SignUpAction): SignUpState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }
    case 'SUBMIT':
      return { ...state, error: '', isLoading: true }
    case 'EMAIL_SENT':
      return { ...state, emailSent: true }
    case 'ERROR':
      return { ...state, error: action.error }
    case 'DONE':
      return { ...state, isLoading: false }
    case 'SOCIAL_START':
      return { ...state, socialLoading: action.provider, error: '' }
    case 'SOCIAL_ERROR':
      return { ...state, error: action.error, socialLoading: null }
    case 'SET_TERMS':
      return { ...state, termsAccepted: action.accepted }
  }
}

const initialState: SignUpState = {
  email: '',
  password: '',
  error: '',
  isLoading: false,
  emailSent: false,
  socialLoading: null,
  termsAccepted: false,
}

export function SignUpForm({ redirectTo = '/campaigns' }: SignUpFormProps) {
  const [state, dispatch] = useReducer(signUpReducer, initialState)
  const { email, password, error, isLoading, emailSent, socialLoading, termsAccepted } = state

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!termsAccepted) {
      dispatch({ type: 'ERROR', error: 'Please accept the Terms of Service to continue' })
      return
    }

    dispatch({ type: 'SUBMIT' })

    let handled = false
    await authClient.signUp
      .email(
        {
          email,
          password,
          name: email
            .split('@')[0]
            .replace(/[._-]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          callbackURL: redirectTo,
        },
        {
          onSuccess: () => {
            handled = true
            dispatch({ type: 'EMAIL_SENT' })
          },
          onError: (ctx) => {
            handled = true
            dispatch({
              type: 'ERROR',
              error: ctx.error.message || 'Failed to create account',
            })
          },
        },
      )
      .catch(() => {
        if (!handled) dispatch({ type: 'ERROR', error: 'Failed to create account' })
      })
      .finally(() => {
        dispatch({ type: 'DONE' })
      })
  }

  const handleSocialSignIn = async (provider: SocialProvider) => {
    dispatch({ type: 'SOCIAL_START', provider })
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: redirectTo,
      })
      // If we reach here without redirect, reset loading state
      dispatch({ type: 'SOCIAL_ERROR', error: '' })
    } catch {
      dispatch({
        type: 'SOCIAL_ERROR',
        error: 'Failed to sign in with social provider',
      })
    }
  }

  const isAuthDisabled = isLoading || !!socialLoading
  const isSubmitDisabled = isAuthDisabled || !termsAccepted

  if (emailSent) {
    return (
      <AuthStatusMessage title="Check your email" linkTo="/sign-in" linkLabel="Back to sign in">
        We sent a verification link to <strong>{email}</strong>. Click the link to verify your
        account.
      </AuthStatusMessage>
    )
  }

  return (
    <AuthFormShell title="Create an account" description="Get started with your adventure">
      <div className="flex flex-col gap-4">
        <AuthGoogleButton
          loading={socialLoading === 'google'}
          disabled={isAuthDisabled}
          onClick={() => handleSocialSignIn('google')}
        />

        <p className="text-center text-xs leading-5 text-muted-foreground">
          By continuing with Google, you agree to the{' '}
          <a
            href={publicSite.routes.terms}
            className="text-primary underline-offset-4 hover:underline"
          >
            Terms of Service
          </a>{' '}
          and acknowledge the{' '}
          <a
            href={publicSite.routes.privacy}
            className="text-primary underline-offset-4 hover:underline"
          >
            Privacy Policy
          </a>
          .
        </p>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground uppercase">or</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={handleEmailSignUp} className="flex flex-col gap-4">
          <AuthEmailField
            value={email}
            onValueChange={(value) =>
              dispatch({
                type: 'SET_FIELD',
                field: 'email',
                value,
              })
            }
            disabled={isAuthDisabled}
          />
          <AuthPasswordField
            id="password"
            label="Password"
            placeholder="Create a password"
            value={password}
            onValueChange={(value) =>
              dispatch({
                type: 'SET_FIELD',
                field: 'password',
                value,
              })
            }
            disabled={isAuthDisabled}
            minLength={8}
            autoComplete="new-password"
            helper={<p className="text-xs text-muted-foreground">Must be at least 8 characters</p>}
          />

          <label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => dispatch({ type: 'SET_TERMS', accepted: e.currentTarget.checked })}
              required
              disabled={isAuthDisabled}
              className="mt-1 size-4 rounded border-border bg-background text-primary"
            />
            <span>
              I agree to the{' '}
              <a
                href={publicSite.routes.terms}
                className="text-primary underline-offset-4 hover:underline"
              >
                Terms of Service
              </a>{' '}
              and acknowledge the{' '}
              <a
                href={publicSite.routes.privacy}
                className="text-primary underline-offset-4 hover:underline"
              >
                Privacy Policy
              </a>
              .
            </span>
          </label>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/sign-in"
            className="text-primary underline-offset-4 hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthFormShell>
  )
}
