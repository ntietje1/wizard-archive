import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from '~/lib/icons'
import { AuthPageLayout } from '~/components/auth/AuthPageLayout'
import { AccountPicker } from '~/components/auth/AccountPicker'
import { SignInForm } from '~/components/auth/SignInForm'
import { useDeviceSessions } from '~/hooks/useAuthSessions'

type SignInSearch = {
  view?: 'form' | 'picker'
}

export const Route = createFileRoute('/sign-in')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    view:
      search.view === 'form'
        ? 'form'
        : search.view === 'picker'
          ? 'picker'
          : undefined,
  }),
})

function RouteComponent() {
  const { view: searchView } = Route.useSearch()
  const { allSessions, isLoaded } = useDeviceSessions()
  const [forceView, setForceView] = useState<'form' | 'picker' | null>(
    searchView ?? null,
  )

  // Sync local state when URL search params change via client-side navigation
  useEffect(() => {
    if (searchView) {
      setForceView(searchView)
    }
  }, [searchView])

  // When picker is forced but sessions haven't loaded yet, show a spinner
  if (forceView === 'picker' && !isLoaded) {
    return (
      <AuthPageLayout>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AuthPageLayout>
    )
  }

  const showPicker = forceView === 'picker' && allSessions.length > 0

  return (
    <AuthPageLayout>
      {showPicker ? (
        <AccountPicker
          sessions={allSessions}
          redirectTo="/campaigns"
          onUseOtherAccount={() => setForceView('form')}
        />
      ) : (
        <SignInForm
          redirectTo="/campaigns"
          existingSessions={allSessions}
          sessionsLoaded={isLoaded}
          onPickAccount={() => setForceView('picker')}
        />
      )}
    </AuthPageLayout>
  )
}
