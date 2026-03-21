import { createFileRoute } from '@tanstack/react-router'
import { AuthPageLayout } from '~/components/auth/AuthPageLayout'
import { ResetPasswordForm } from '~/components/auth/ResetPasswordForm'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
})

function ResetPasswordPage() {
  return (
    <AuthPageLayout>
      <ResetPasswordForm />
    </AuthPageLayout>
  )
}
