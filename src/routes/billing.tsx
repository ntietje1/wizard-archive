import { createFileRoute } from '@tanstack/react-router'
import { publicPolicyPages } from '~/features/landing/content/public-policy-pages'
import { publicPageHead } from '~/features/landing/content/public-site'
import { BillingRouteComponent } from './-policy-route-components'

const billingPage = publicPolicyPages.billing

export const Route = createFileRoute('/billing')({
  head: () => publicPageHead(billingPage.head),
  component: BillingRouteComponent,
})
