import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordPage } from '~/features/auth/pages/reset-password-page'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
})
