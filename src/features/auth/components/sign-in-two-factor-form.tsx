import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { authClient } from '~/features/auth/utils/auth-client'
import { Button } from '~/features/shadcn/components/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '~/features/shadcn/components/input-otp'

type SignInTwoFactorFormProps = {
  onSuccess: () => void
  onBack: () => void
}

export function SignInTwoFactorForm({ onSuccess, onBack }: SignInTwoFactorFormProps) {
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await authClient.twoFactor.verifyTotp(
        { code: totpCode },
        {
          onSuccess: () => {
            onSuccess()
          },
          onError: (ctx: { error: { message?: string } }) => {
            setError(ctx.error.message || 'Invalid code')
            setTotpCode('')
          },
        },
      )
    } catch {
      setError('Unable to verify. Please try again.')
      setTotpCode('')
    }
    setIsLoading(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
        <p className="text-sm text-muted-foreground text-balance">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>
      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={totpCode}
            onChange={setTotpCode}
            disabled={isLoading}
            aria-describedby={error ? 'totp-error' : undefined}
            aria-invalid={!!error}
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
          <p id="totp-error" role="alert" className="text-sm text-destructive text-center">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isLoading || totpCode.length !== 6}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
        </Button>

        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
          Back to sign in
        </Button>
      </form>
    </div>
  )
}
