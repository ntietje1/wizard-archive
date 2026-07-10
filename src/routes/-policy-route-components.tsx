import { PublicPolicyPage, PublicSecurityPage } from '~/features/landing/components/policy-page'
import {
  publicPolicyPages,
  publicSecurityPage,
} from '~/features/landing/content/public-policy-pages'

export function PrivacyRouteComponent() {
  return <PublicPolicyPage page={publicPolicyPages.privacy} />
}

export function TermsRouteComponent() {
  return <PublicPolicyPage page={publicPolicyPages.terms} />
}

export function BillingRouteComponent() {
  return <PublicPolicyPage page={publicPolicyPages.billing} />
}

export function SecurityRouteComponent() {
  return <PublicSecurityPage page={publicSecurityPage} />
}
