import { createFileRoute } from '@tanstack/react-router'
import { AuthPageLayout } from '~/components/auth/AuthPageLayout'
import { SignUpForm } from '~/components/auth/SignUpForm'

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  return (
    <AuthPageLayout>
      <SignUpForm redirectTo="/campaigns" />
    </AuthPageLayout>
  )
}
