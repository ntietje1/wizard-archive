import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '~/features/shadcn/components/button'

const COOLDOWN_SECONDS = 60

type SignInEmailNotVerifiedProps = {
  email: string
  onBack: () => void
}

export function SignInEmailNotVerified({ email, onBack }: SignInEmailNotVerifiedProps) {
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleResend = async () => {
    setIsResending(true)
    setError('')
    try {
      await authClient.sendVerificationEmail(
        { email },
        {
          onSuccess: () => {
            setCooldown(COOLDOWN_SECONDS)
            setIsResending(false)
          },
          onError: (ctx: { error: { message?: string } }) => {
            setError(ctx.error.message || 'Failed to resend verification email')
            setIsResending(false)
          },
        },
      )
    } catch {
      setError('Unable to send verification email. Please try again.')
      setIsResending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Verify your email</h1>
        <p className="text-sm text-muted-foreground text-balance">
          Your email address hasn't been verified yet. Check your inbox for a verification link.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Button onClick={handleResend} disabled={isResending || cooldown > 0} className="w-full">
          {isResending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : cooldown > 0 ? (
            `Resend in ${cooldown}s`
          ) : (
            'Resend verification email'
          )}
        </Button>
        {cooldown > 0 && (
          <p className="text-sm text-green-600 text-center">
            Verification email sent! Check your inbox.
          </p>
        )}
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <Button variant="ghost" className="w-full" onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    </div>
  )
}
