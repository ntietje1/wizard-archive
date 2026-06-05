import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { AuthPageLayout } from '../components/auth-page-layout'
import { AccountPicker } from '../components/account-picker'
import { SignInForm } from '../components/sign-in-form'
import { useDeviceSessions } from '../hooks/useAuthSessions'
import { Button } from '~/features/shadcn/components/button'

export function SignInPage({ view }: { view?: 'form' | 'picker' }) {
  const navigate = useNavigate()
  const { allSessions, isLoaded, isError, retry } = useDeviceSessions()

  if (view === 'picker' && !isLoaded && !isError) {
    return (
      <AuthPageLayout>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AuthPageLayout>
    )
  }

  if (view === 'picker' && isError) {
    return (
      <AuthPageLayout>
        <DeviceSessionsFailed
          onRetry={retry}
          onUseOtherAccount={() => navigate({ to: '/sign-in', search: { view: 'form' } })}
        />
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
          onUseOtherAccount={() => navigate({ to: '/sign-in', search: { view: 'form' } })}
        />
      ) : (
        <SignInForm
          redirectTo="/campaigns"
          existingSessions={allSessions}
          sessionsLoaded={isLoaded}
          onPickAccount={() => navigate({ to: '/sign-in', search: { view: 'picker' } })}
        />
      )}
    </AuthPageLayout>
  )
}

function DeviceSessionsFailed({
  onRetry,
  onUseOtherAccount,
}: {
  onRetry: () => unknown
  onUseOtherAccount: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1 className="text-2xl font-bold">Could Not Load Accounts</h1>
      <p className="text-sm text-muted-foreground">
        Saved accounts could not be loaded. You can retry or sign in with a different account.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => void onRetry()}>
          Try Again
        </Button>
        <Button type="button" onClick={onUseOtherAccount}>
          Sign In
        </Button>
      </div>
    </div>
  )
}
