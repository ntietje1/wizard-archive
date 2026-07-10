import { createFileRoute } from '@tanstack/react-router'
import { publicPageHead } from '~/features/landing/content/public-site'
import { PricingRouteComponent } from './-pricing-route'

export const Route = createFileRoute('/pricing')({
  head: () =>
    publicPageHead({
      title: 'Pricing',
      description:
        "Pricing, trial, and paid plan details for The Wizard's Archive campaign workspace.",
    }),
  component: PricingRouteComponent,
})
