import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordForm } from '~/components/auth/ResetPasswordForm'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) ?? undefined,
  }),
})

function ResetPasswordPage() {
  return (
    <div className="flex items-center justify-center h-screen bg-muted">
      <ResetPasswordForm />
    </div>
  )
}
