import { useReducer } from 'react'
import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import { Label } from '~/features/shadcn/components/label'
import { Separator } from '~/features/shadcn/components/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'
import { GoogleIcon } from '~/features/auth/utils/custom-icons'
import { isPreview } from '~/shared/utils/preview'

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
}

type SignUpAction =
  | { type: 'SET_FIELD'; field: 'email' | 'password'; value: string }
  | { type: 'SUBMIT' }
  | { type: 'EMAIL_SENT' }
  | { type: 'ERROR'; error: string }
  | { type: 'DONE' }
  | { type: 'SOCIAL_START'; provider: SocialProvider }
  | { type: 'SOCIAL_ERROR'; error: string }

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
  }
}

const initialState: SignUpState = {
  email: '',
  password: '',
  error: '',
  isLoading: false,
  emailSent: false,
  socialLoading: null,
}

export function SignUpForm({ redirectTo = '/campaigns' }: SignUpFormProps) {
  const [state, dispatch] = useReducer(signUpReducer, initialState)
  const { email, password, error, isLoading, emailSent, socialLoading } = state

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
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

  const isDisabled = isLoading || !!socialLoading

  if (emailSent) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-muted-foreground text-balance">
            We sent a verification link to <strong>{email}</strong>. Click the link to verify your
            account.
          </p>
        </div>
        <Link
          to="/sign-in"
          className="text-sm text-primary underline-offset-4 hover:underline font-medium flex justify-center"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Create an account</h1>
        <p className="text-sm text-muted-foreground text-balance">
          Get started with your adventure
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {/* Social login buttons */}
        <Tooltip>
          <TooltipTrigger render={<span className="w-full" />} disabled={!isPreview}>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleSocialSignIn('google')}
              disabled={isDisabled || isPreview}
            >
              {socialLoading === 'google' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            OAuth is unavailable on preview deployments. Use email and password instead.
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground uppercase">or</span>
          <Separator className="flex-1" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmailSignUp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FIELD',
                  field: 'email',
                  value: e.target.value,
                })
              }
              required
              disabled={isDisabled}
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FIELD',
                  field: 'password',
                  value: e.target.value,
                })
              }
              required
              minLength={8}
              disabled={isDisabled}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <Button type="submit" className="w-full" disabled={isDisabled}>
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
    </div>
  )
}
