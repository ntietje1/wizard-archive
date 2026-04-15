import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordPage } from '~/features/auth/pages/forgot-password-page'

export const Route = createFileRoute('/_app/forgot-password')({
  component: ForgotPasswordPage,
})
