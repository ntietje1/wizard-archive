import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '~/features/auth/pages/home-page'

export const Route = createFileRoute('/')({
  component: HomePage,
})
