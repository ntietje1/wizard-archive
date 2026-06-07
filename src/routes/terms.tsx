import { createFileRoute } from '@tanstack/react-router'
import { PublicPolicyPage } from '~/features/landing/components/policy-page'
import { publicPolicyPages } from '~/features/landing/content/public-policy-pages'
import { publicPageHead } from '~/features/landing/content/public-site'

const termsPage = publicPolicyPages.terms

function TermsRouteComponent() {
  return <PublicPolicyPage page={termsPage} />
}

export const Route = createFileRoute('/terms')({
  head: () => publicPageHead(termsPage.head),
  component: TermsRouteComponent,
})
