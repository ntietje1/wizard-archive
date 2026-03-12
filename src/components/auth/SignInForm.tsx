import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
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
  const [view, setView] = useState<View>('credentials')
  const [email, setEmail] = useState('')

  switch (view) {
    case 'two-factor':
      return (
        <SignInTwoFactorForm
          onSuccess={() => navigate({ to: redirectTo, reloadDocument: true })}
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
    case 'credentials':
      return (
        <SignInCredentialsForm
          redirectTo={redirectTo}
          existingSessions={existingSessions}
          sessionsLoaded={sessionsLoaded}
          onPickAccount={onPickAccount}
          onSuccess={() => navigate({ to: redirectTo, reloadDocument: true })}
          onTwoFactor={() => setView('two-factor')}
          onEmailNotVerified={() => setView('email-not-verified')}
          email={email}
          onEmailChange={setEmail}
        />
      )
    default: {
      const _exhaustiveCheck: never = view
      return _exhaustiveCheck
    }
  }
}
