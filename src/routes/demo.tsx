import { createFileRoute } from '@tanstack/react-router'
import { DemoRouteContent } from '~/features/landing/components/demo-route-content'
import { publicPageHead } from '~/features/landing/content/public-site'

export const Route = createFileRoute('/demo')({
  head: () =>
    publicPageHead({
      title: 'Demo',
      description: "Demo project preview for The Wizard's Archive.",
    }),
  component: DemoRouteContent,
})
