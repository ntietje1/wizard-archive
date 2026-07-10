import { createFileRoute } from '@tanstack/react-router'
import { publicPolicyPages } from '~/features/landing/content/public-policy-pages'
import { publicPageHead } from '~/features/landing/content/public-site'
import { TermsRouteComponent } from './-policy-route-components'

const termsPage = publicPolicyPages.terms

export const Route = createFileRoute('/terms')({
  head: () => publicPageHead(termsPage.head),
  component: TermsRouteComponent,
})
