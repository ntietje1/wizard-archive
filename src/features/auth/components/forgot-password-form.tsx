import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { AuthEmailField, AuthFormShell, AuthStatusMessage } from './auth-form-elements'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '@wizard-archive/ui/shadcn/components/button'

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
      .catch(() => {
        setSubmitted(true)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  if (submitted) {
    return (
      <AuthStatusMessage title="Check your email" linkTo="/sign-in" linkLabel="Back to sign in">
        If an account exists for {email}, we sent a password reset link.
      </AuthStatusMessage>
    )
  }

  return (
    <AuthFormShell
      title="Forgot password"
      description="Enter your email and we'll send you a reset link"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthEmailField value={email} onValueChange={setEmail} disabled={isLoading} />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Sending...</span>
            </>
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
    </AuthFormShell>
  )
}
