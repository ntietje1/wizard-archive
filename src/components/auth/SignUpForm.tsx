import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { Link } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { authClient } from '~/lib/auth-client'
import { Button } from '~/components/shadcn/ui/button'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Separator } from '~/components/shadcn/ui/separator'
import { Loader2 } from '~/lib/icons'
import { GoogleIcon } from '~/lib/custom-icons'

type SignUpFormProps = {
  redirectTo?: string
}

type SocialProvider = 'google'

export function SignUpForm({ redirectTo = '/campaigns' }: SignUpFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(
    null,
  )

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    let handled = false
    await authClient.signUp
      .email(
        { email, password, name },
        {
          onSuccess: () => {
            handled = true
            setEmailSent(true)
          },
          onError: (ctx) => {
            handled = true
            setError(ctx.error.message || 'Failed to create account')
          },
        },
      )
      .catch(() => {
        if (!handled) setError('Failed to create account')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const handleSocialSignIn = async (provider: SocialProvider) => {
    setSocialLoading(provider)
    setError('')
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: redirectTo,
      })
    } catch {
      setError('Failed to sign in with social provider')
      setSocialLoading(null)
    }
  }

  const isDisabled = isLoading || !!socialLoading

  const { data: verified } = useQuery({
    ...convexQuery(api.users.queries.isEmailVerified, { email }),
    enabled: emailSent,
  })

  if (emailSent) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          {verified ? (
            <>
              <h1 className="text-2xl font-bold">Email verified!</h1>
              <p className="text-sm text-muted-foreground text-balance">
                Your account is ready. Sign in to get started.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-sm text-muted-foreground text-balance">
                We sent a verification link to <strong>{email}</strong>. Click
                the link to verify your account.
              </p>
            </>
          )}
        </div>
        <Link
          to="/sign-in"
          className="text-sm text-primary underline-offset-4 hover:underline font-medium flex justify-center"
        >
          {verified ? 'Sign in' : 'Back to sign in'}
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
        <form onSubmit={handleEmailSignUp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isDisabled}
            />
          </div>
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isDisabled}
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isDisabled}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Create account'
            )}
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
