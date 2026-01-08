import { SignIn } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sign-in')({
  component: RouteComponent,
})

function RouteComponent() {
  const redirectUrl = '/auth-redirect'

  return (
    <div className="flex items-center justify-center h-screen">
      <SignIn routing="virtual" fallbackRedirectUrl={redirectUrl} />
    </div>
  )
}
