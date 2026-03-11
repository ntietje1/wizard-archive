import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AuthPageLayout } from '~/components/auth/AuthPageLayout'
import { AccountPicker } from '~/components/auth/AccountPicker'
import { SignInForm } from '~/components/auth/SignInForm'
import { useDeviceSessions } from '~/hooks/useAuthSessions'

type SignInSearch = {
  view?: 'form'
}

export const Route = createFileRoute('/sign-in')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    view: search.view === 'form' ? 'form' : undefined,
  }),
})

function RouteComponent() {
  const { view: searchView } = Route.useSearch()
  const { allSessions, isLoaded } = useDeviceSessions()
  const [forceForm, setForceForm] = useState(searchView === 'form')

  const showPicker = isLoaded && !forceForm && allSessions.length > 0

  return (
    <AuthPageLayout>
      {showPicker ? (
        <AccountPicker
          sessions={allSessions}
          redirectTo="/campaigns"
          onUseOtherAccount={() => setForceForm(true)}
        />
      ) : (
        <SignInForm
          redirectTo="/campaigns"
          existingSessions={allSessions}
          sessionsLoaded={isLoaded}
          onPickAccount={() => setForceForm(false)}
        />
      )}
    </AuthPageLayout>
  )
}
