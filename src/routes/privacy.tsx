import { createFileRoute } from '@tanstack/react-router'
import { PublicPolicyPage } from '~/features/landing/components/policy-page'
import { publicPolicyPages } from '~/features/landing/content/public-policy-pages'
import { publicPageHead } from '~/features/landing/content/public-site'

const privacyPage = publicPolicyPages.privacy

function PrivacyRouteComponent() {
  return <PublicPolicyPage page={privacyPage} />
}

export const Route = createFileRoute('/privacy')({
  head: () => publicPageHead(privacyPage.head),
  component: PrivacyRouteComponent,
})
