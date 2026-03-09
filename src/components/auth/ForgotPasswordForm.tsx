import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { authClient } from '~/lib/auth-client'
import { Button } from '~/components/shadcn/ui/button'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import { Loader2 } from '~/lib/icons'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    await authClient
      .requestPasswordReset(
        { email, redirectTo: '/reset-password' },
        {
          onSuccess: () => setSubmitted(true),
          onError: () => setSubmitted(true),
        },
      )
      .finally(() => {
        setIsLoading(false)
      })
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-muted-foreground text-balance">
            If an account exists for {email}, we sent a password reset link.
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
        <h1 className="text-2xl font-bold">Forgot password</h1>
        <p className="text-sm text-muted-foreground text-balance">
          Enter your email and we'll send you a reset link
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Send reset link'
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/sign-in"
            className="text-primary underline-offset-4 hover:underline font-medium"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
