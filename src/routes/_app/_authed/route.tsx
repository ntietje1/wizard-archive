import { createFileRoute } from '@tanstack/react-router'
import { AuthedLayout } from '~/features/auth/pages/authed-layout'

export const Route = createFileRoute('/_app/_authed')({
  component: AuthedLayout,
})
