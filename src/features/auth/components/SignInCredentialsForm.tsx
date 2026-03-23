import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { DeviceSession } from '~/features/auth/utils/device-sessions'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import { Label } from '~/features/shadcn/components/label'
import { Separator } from '~/features/shadcn/components/separator'
import { Loader2 } from '~/features/shared/utils/icons'
import { GoogleIcon } from '~/features/auth/utils/custom-icons'

type SignInCredentialsFormProps = {
  redirectTo: string
  existingSessions: Array<DeviceSession>
  sessionsLoaded: boolean
  onPickAccount?: () => void
  onSuccess: () => void
  onTwoFactor: () => void
  onEmailNotVerified: () => void
  email: string
  onEmailChange: (email: string) => void
  password: string
  onPasswordChange: (password: string) => void
}

export function SignInCredentialsForm({
  redirectTo,
  existingSessions,
  sessionsLoaded,
  onPickAccount,
  onSuccess,
  onTwoFactor,
  onEmailNotVerified,
  email,
  onEmailChange,
  password,
  onPasswordChange,
}: SignInCredentialsFormProps) {
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await authClient.signIn.email(
        { email, password },
        {
          onSuccess: (ctx) => {
            if (ctx.data?.twoFactorRedirect) {
              setIsLoading(false)
              onTwoFactor()
              return
            }
            setIsLoading(false)
            onSuccess()
          },
          onError: (ctx) => {
            if (ctx.error.code === 'EMAIL_NOT_VERIFIED') {
              onEmailNotVerified()
            } else {
              setError(ctx.error.message || 'Invalid email or password')
            }
            setIsLoading(false)
          },
        },
      )
    } catch {
      setError('Unable to sign in. Please try again.')
      setIsLoading(false)
    }
  }

  const handleSocialSignIn = async (
    provider: 'github' | 'google' | 'discord',
  ) => {
    setSocialLoading(provider)
    setError('')
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: redirectTo,
      })
    } catch {
      setError('Unable to sign in. Please try again.')
      setSocialLoading(null)
    }
  }

  const isDisabled = isLoading || !!socialLoading

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground text-balance">
          Sign in to your account
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {/* Social login buttons */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleSocialSignIn('google')}
          disabled={isDisabled}
        >
          {socialLoading === 'google' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </Button>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground uppercase">or</span>
          <Separator className="flex-1" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              required
              disabled={isDisabled}
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              required
              disabled={isDisabled}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isDisabled}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {"Don't have an account? "}
          <Link
            to="/sign-up"
            className="text-primary underline-offset-4 hover:underline font-medium"
          >
            Sign up
          </Link>
        </p>
        <p
          className={`text-center text-sm transition-opacity ${sessionsLoaded && existingSessions.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <Button
            type="button"
            variant="link"
            onClick={() => onPickAccount?.()}
          >
            Switch to an existing account
          </Button>
        </p>
      </div>
    </div>
  )
}
