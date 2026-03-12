import { useState } from 'react'
import { SignInCredentialsForm } from './SignInCredentialsForm'
import { SignInTwoFactorForm } from './SignInTwoFactorForm'
import { SignInEmailNotVerified } from './SignInEmailNotVerified'
import type { DeviceSession } from '~/lib/device-sessions'
import { usePendingAuthRedirect } from '~/hooks/usePendingAuthRedirect'

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
  const setPendingRedirect = usePendingAuthRedirect()
  const [view, setView] = useState<View>('credentials')
  const [email, setEmail] = useState('')

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
