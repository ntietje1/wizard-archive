import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from '~/features/landing/components/landing-page'
import { publicPageHead } from '~/features/landing/content/public-site'

export const Route = createFileRoute('/')({
  head: () =>
    publicPageHead({
      title: "Wizard's Archive",
      description: 'A collaborative campaign manager for TTRPG groups.',
    }),
  component: LandingPage,
})
