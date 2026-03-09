import { createFileRoute } from '@tanstack/react-router'
import { AuthPageLayout } from '~/components/auth/AuthPageLayout'
import { SignInForm } from '~/components/auth/SignInForm'

export const Route = createFileRoute('/sign-in')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <AuthPageLayout>
      <SignInForm redirectTo="/campaigns" />
    </AuthPageLayout>
  )
}
