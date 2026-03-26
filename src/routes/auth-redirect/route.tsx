import { createFileRoute } from '@tanstack/react-router'
import { AuthRedirectPage } from '~/features/auth/pages/auth-redirect-page'

export const Route = createFileRoute('/auth-redirect')({
  component: AuthRedirectPage,
})
