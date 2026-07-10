import { createFileRoute } from '@tanstack/react-router'
import { SignInRouteComponent } from './-sign-in-route'

type SignInSearch = {
  view?: 'form' | 'picker'
}

export const Route = createFileRoute('/_app/sign-in')({
  component: SignInRouteComponent,
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    view: search.view === 'form' ? 'form' : search.view === 'picker' ? 'picker' : undefined,
  }),
})
