import { createFileRoute } from '@tanstack/react-router'
import { PublicPolicyPage } from '~/features/landing/components/policy-page'
import { publicPolicyPages } from '~/features/landing/content/public-policy-pages'
import { publicPageHead } from '~/features/landing/content/public-site'

const billingPage = publicPolicyPages.billing

function BillingRouteComponent() {
  return <PublicPolicyPage page={billingPage} />
}

export const Route = createFileRoute('/billing')({
  head: () => publicPageHead(billingPage.head),
  component: BillingRouteComponent,
})
