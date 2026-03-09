import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
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
import { Loader2 } from '~/lib/icons'
import { GoogleIcon } from '~/lib/custom-icons'

type SignUpFormProps = {
  redirectTo?: string
}

export function SignUpForm({ redirectTo = '/campaigns' }: SignUpFormProps) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    await authClient.signUp.email(
      { email, password, name },
      {
        onSuccess: () => {
          navigate({ to: redirectTo }).then(() => {
            setIsLoading(false)
          })
        },
        onError: (ctx) => {
          setError(ctx.error.message || 'Failed to create account')
          setIsLoading(false)
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
      setError('Failed to sign in with social provider')
      setSocialLoading(null)
    }
  }

  const isDisabled = isLoading || !!socialLoading

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create an account</CardTitle>
        <CardDescription>Get started with your adventure</CardDescription>
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
      </CardContent>
    </Card>
  )
}
