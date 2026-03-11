import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { SignInCredentialsForm } from './SignInCredentialsForm'
import { SignInTwoFactorForm } from './SignInTwoFactorForm'
import { SignInEmailNotVerified } from './SignInEmailNotVerified'
import type { DeviceSession } from '~/lib/device-sessions'

type SignInFormProps = {
  redirectTo?: string
  existingSessions?: Array<DeviceSession>
  sessionsLoaded?: boolean
  onPickAccount: () => void
}

type View = 'credentials' | 'two-factor' | 'email-not-verified'

export function SignInForm({
  redirectTo = '/campaigns',
  existingSessions = [],
  sessionsLoaded = false,
  onPickAccount,
}: SignInFormProps) {
  const navigate = useNavigate()
  const { isAuthenticated } = useConvexAuth()
  const [view, setView] = useState<View>('credentials')
  const [email, setEmail] = useState('')
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null)

  useEffect(() => {
    if (pendingRedirect && isAuthenticated) {
      navigate({ to: pendingRedirect })
      setPendingRedirect(null)
    }
  }, [pendingRedirect, isAuthenticated, navigate])

  switch (view) {
    case 'two-factor':
      return (
        <SignInTwoFactorForm
          onSuccess={() => setPendingRedirect(redirectTo)}
          onBack={() => setView('credentials')}
        />
      )
    case 'email-not-verified':
      return (
        <SignInEmailNotVerified
          email={email}
          onBack={() => setView('credentials')}
        />
      )
    default:
      return (
        <SignInCredentialsForm
          redirectTo={redirectTo}
          existingSessions={existingSessions}
          sessionsLoaded={sessionsLoaded}
          onPickAccount={onPickAccount}
          onSuccess={() => setPendingRedirect(redirectTo)}
          onTwoFactor={() => setView('two-factor')}
          onEmailNotVerified={() => setView('email-not-verified')}
          email={email}
          onEmailChange={setEmail}
        />
      )
  }
}
