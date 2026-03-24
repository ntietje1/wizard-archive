import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { SignInCredentialsForm } from './sign-in-credentials-form'
import { SignInTwoFactorForm } from './sign-in-two-factor-form'
import { SignInEmailNotVerified } from './sign-in-email-not-verified'
import type { DeviceSession } from '~/features/auth/utils/device-sessions'

type SignInFormProps = {
  redirectTo?: string
  existingSessions?: Array<DeviceSession>
  sessionsLoaded?: boolean
  onPickAccount?: () => void
}

type View = 'credentials' | 'two-factor' | 'email-not-verified'

const EMPTY_SESSIONS: Array<DeviceSession> = []

export function SignInForm({
  redirectTo = '/campaigns',
  existingSessions = EMPTY_SESSIONS,
  sessionsLoaded = false,
  onPickAccount,
}: SignInFormProps) {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSuccess = () => navigate({ to: redirectTo, reloadDocument: true })

  switch (view) {
    case 'two-factor':
      return (
        <SignInTwoFactorForm
          onSuccess={handleSuccess}
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
          onSuccess={handleSuccess}
          onTwoFactor={() => setView('two-factor')}
          onEmailNotVerified={() => setView('email-not-verified')}
          email={email}
          onEmailChange={setEmail}
          password={password}
          onPasswordChange={setPassword}
        />
      )
    default: {
      const _exhaustiveCheck: never = view
      return _exhaustiveCheck
    }
  }
}
