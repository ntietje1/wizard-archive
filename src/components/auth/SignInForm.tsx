import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { authClient } from '~/lib/auth-client'
import { Button } from '~/components/shadcn/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/shadcn/ui/card'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Separator } from '~/components/shadcn/ui/separator'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '~/components/shadcn/ui/input-otp'
import { Loader2 } from '~/lib/icons'
import { GoogleIcon } from '~/lib/custom-icons'

type SignInFormProps = {
  redirectTo?: string
}

export function SignInForm({ redirectTo = '/campaigns' }: SignInFormProps) {
  const navigate = useNavigate()
  const { isAuthenticated } = useConvexAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)
  const [showTwoFactor, setShowTwoFactor] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null)

  // Navigate only after Convex has the auth token
  useEffect(() => {
    if (pendingRedirect && isAuthenticated) {
      navigate({ to: pendingRedirect })
      setPendingRedirect(null)
    }
  }, [pendingRedirect, isAuthenticated, navigate])

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    await authClient.signIn.email(
      { email, password },
      {
        onSuccess: (ctx) => {
          if (ctx.data?.twoFactorRedirect) {
            setShowTwoFactor(true)
            setIsLoading(false)
            return
          }
          setPendingRedirect(redirectTo)
        },
        onError: (ctx) => {
          setError(ctx.error.message || 'Invalid email or password')
          setIsLoading(false)
        },
      },
    )
  }

  const handleTwoFactorVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    await authClient.twoFactor.verifyTotp(
      { code: totpCode },
      {
        onSuccess: () => {
          setPendingRedirect(redirectTo)
        },
        onError: (ctx) => {
          setError(ctx.error.message || 'Invalid code')
          setIsLoading(false)
          setTotpCode('')
        },
      },
    )
  }

  const handleSocialSignIn = async (
    provider: 'github' | 'google' | 'discord',
  ) => {
    setSocialLoading(provider)
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: redirectTo,
      })
    } catch {
      setSocialLoading(null)
    }
  }

  const isDisabled = isLoading || !!socialLoading || !!pendingRedirect

  if (showTwoFactor) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleTwoFactorVerify}
            className="flex flex-col gap-4"
          >
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={totpCode}
                onChange={setTotpCode}
                disabled={isLoading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || totpCode.length !== 6}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Verify'
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setShowTwoFactor(false)
                setTotpCode('')
                setError('')
              }}
            >
              Back to sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {/* Social login buttons */}
          <div className="flex flex-col gap-2">
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
          </div>

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
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isDisabled}
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
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isDisabled}
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
        </div>
      </CardContent>
    </Card>
  )
}

