import { createFileRoute } from '@tanstack/react-router'
import { AuthRedirectPage } from '~/features/auth/pages/auth-redirect-page'

export const Route = createFileRoute('/_app/auth-redirect')({
  component: AuthRedirectPage,
})
