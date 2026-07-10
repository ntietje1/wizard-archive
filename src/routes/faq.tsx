import { createFileRoute } from '@tanstack/react-router'
import { publicPageHead } from '~/features/landing/content/public-site'
import { FaqRouteComponent } from './-faq-route'

export const Route = createFileRoute('/faq')({
  head: () =>
    publicPageHead({
      title: 'FAQ',
      description:
        "Product, pricing, trial, privacy, and support answers for The Wizard's Archive campaign workspace.",
    }),
  component: FaqRouteComponent,
})
