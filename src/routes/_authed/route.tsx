import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { SignInForm } from '~/components/auth/SignInForm'
import { Card, CardContent } from '~/components/shadcn/ui/card'
import { SettingsDialog } from '~/components/settings/SettingsDialog'

function AuthedRouteComponent() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const location = useLocation()

  // intentionally allow rendering of pages even when loading auth
  // any sensitive information is behind an authed query anyway, which will show as loading until successfully authed
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center p-24">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6">
            <SignInForm redirectTo={location.href} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <Outlet />
      <SettingsDialog />
    </div>
  )
}

export const Route = createFileRoute('/_authed')({
  component: AuthedRouteComponent,
})
