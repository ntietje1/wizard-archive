import { createFileRoute, useNavigate } from '@tanstack/react-router'
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
  const { view } = Route.useSearch()
  const navigate = useNavigate()
  const { allSessions, isLoaded } = useDeviceSessions()

  // When picker is forced but sessions haven't loaded yet, show a spinner
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
