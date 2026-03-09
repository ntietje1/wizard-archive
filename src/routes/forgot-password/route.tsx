import { createFileRoute } from '@tanstack/react-router'
import { AuthPageLayout } from '~/components/auth/AuthPageLayout'
import { ForgotPasswordForm } from '~/components/auth/ForgotPasswordForm'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <AuthPageLayout>
      <ForgotPasswordForm />
    </AuthPageLayout>
  )
}
