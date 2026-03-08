import { Outlet, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { SignInForm } from '~/components/auth/SignInForm'

function AuthedRouteComponent() {
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (!isLoading && !isAuthenticated) {
    const redirectTo =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '/campaigns'
    return (
      <div className="flex items-center justify-center p-24">
        <SignInForm redirectTo={redirectTo} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <Outlet />
    </div>
  )
}

export const Route = createFileRoute('/_authed')({
  component: AuthedRouteComponent,
})
