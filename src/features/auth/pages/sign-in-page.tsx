import { useNavigate } from '@tanstack/react-router'
import { AuthPageLayout } from '../components/AuthPageLayout'
import { AccountPicker } from '../components/AccountPicker'
import { SignInForm } from '../components/SignInForm'
import { useDeviceSessions } from '../hooks/useAuthSessions'
import { Loader2 } from '~/features/shared/utils/icons'

export function SignInPage({ view }: { view?: 'form' | 'picker' }) {
  const navigate = useNavigate()
  const { allSessions, isLoaded } = useDeviceSessions()

  if (view === 'picker' && !isLoaded) {
    return (
      <AuthPageLayout>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AuthPageLayout>
    )
  }

  const showPicker = view === 'picker' && allSessions.length > 0

  return (
    <AuthPageLayout>
      {showPicker ? (
        <AccountPicker
          sessions={allSessions}
          redirectTo="/campaigns"
          onUseOtherAccount={() =>
            navigate({ to: '/sign-in', search: { view: 'form' } })
          }
        />
      ) : (
        <SignInForm
          redirectTo="/campaigns"
          existingSessions={allSessions}
          sessionsLoaded={isLoaded}
          onPickAccount={() =>
            navigate({ to: '/sign-in', search: { view: 'picker' } })
          }
        />
      )}
    </AuthPageLayout>
  )
}
