import { createFileRoute } from '@tanstack/react-router'
import { SignInForm } from '~/components/auth/SignInForm'

export const Route = createFileRoute('/sign-in')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex items-center justify-center h-screen bg-muted">
      <SignInForm redirectTo="/campaigns" />
    </div>
  )
}
