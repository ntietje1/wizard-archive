import { useSearch } from '@tanstack/react-router'
import { SignInPage } from '~/features/auth/pages/sign-in-page'

export function SignInRouteComponent() {
  const { view } = useSearch({ from: '/_app/sign-in' })

  return <SignInPage view={view} />
}
