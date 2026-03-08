import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordForm } from '~/components/auth/ForgotPasswordForm'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <div className="flex items-center justify-center h-screen bg-muted">
      <ForgotPasswordForm />
    </div>
  )
}
