import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '~/components/shadcn/ui/input-otp'
import { Loader2 } from '~/lib/icons'

type EnableTwoFactorProps = {
  onComplete: () => void
  onCancel: () => void
}

type Step = 'password' | 'qr' | 'verify' | 'backup-codes'

export function EnableTwoFactor({
  onComplete,
  onCancel,
}: EnableTwoFactorProps) {
  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [totpUri, setTotpUri] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<Array<string>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (totpUri) {
      QRCode.toDataURL(totpUri, { width: 200, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => setError('Failed to generate QR code'))
    }
  }, [totpUri])

  const handlePasswordVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const { data, error: err } = await authClient.twoFactor.enable({
      password,
    })

    if (err) {
      setError(err.message || 'Invalid password')
      setIsLoading(false)
      return
    }

    if (data?.totpURI) {
      setTotpUri(data.totpURI)
      setBackupCodes(data.backupCodes ?? [])
      setStep('qr')
    } else {
      setError('Failed to set up two-factor authentication. Please try again.')
    }
    setIsLoading(false)
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const { error: err } = await authClient.twoFactor.verifyTotp({
      code: totpCode,
    })

    if (err) {
      setError(err.message || 'Invalid code')
      setTotpCode('')
      setIsLoading(false)
      return
    }

    setStep('backup-codes')
    setIsLoading(false)
  }

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (step === 'password') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Enable Two-Factor Authentication
          </CardTitle>
          <CardDescription>Enter your password to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordVerify} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="2fa-password">Password</Label>
              <Input
                id="2fa-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  if (step === 'qr') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scan QR Code</CardTitle>
          <CardDescription>
            Scan this QR code with your authenticator app (e.g. Google
            Authenticator, Authy)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="2FA QR Code" className="rounded-lg" />
          ) : (
            <div className="h-[200px] w-[200px] flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center break-all max-w-xs">
            Can't scan? Enter this key manually:{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">
              {totpUri.match(/secret=([^&]+)/)?.[1] ?? ''}
            </code>
          </p>

          <Button onClick={() => setStep('verify')} className="w-full">
            I've scanned the code
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (step === 'verify') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Verify Code</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app to confirm setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
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

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('qr')}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isLoading || totpCode.length !== 6}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Verify'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  // backup-codes step
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Save Backup Codes</CardTitle>
        <CardDescription>
          Store these codes in a safe place. You can use them to sign in if you
          lose access to your authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="bg-muted rounded-lg p-4 font-mono text-sm grid grid-cols-2 gap-2">
          {backupCodes.map((code, index) => (
            <span key={index}>{code}</span>
          ))}
        </div>

        <Button variant="outline" onClick={handleCopyBackupCodes}>
          {copied ? 'Copied!' : 'Copy codes'}
        </Button>

        <Button onClick={onComplete}>I've saved my codes</Button>
      </CardContent>
    </Card>
  )
}
