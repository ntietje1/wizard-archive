import { createFileRoute } from '@tanstack/react-router'
import { publicPageHead } from '~/features/landing/content/public-site'
import { LocalDemoRouteContent } from './-demo-content'

export const Route = createFileRoute('/demo')({
  head: () =>
    publicPageHead({
      title: 'Demo',
      description: "Demo project preview for The Wizard's Archive.",
    }),
  component: LocalDemoRouteContent,
})
