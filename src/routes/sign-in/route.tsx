import { createFileRoute } from '@tanstack/react-router'
import { SignInPage } from '~/features/auth/pages/sign-in-page'

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
  return <SignInPage view={view} />
}
