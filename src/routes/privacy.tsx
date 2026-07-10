import { createFileRoute } from '@tanstack/react-router'
import { publicPolicyPages } from '~/features/landing/content/public-policy-pages'
import { publicPageHead } from '~/features/landing/content/public-site'
import { PrivacyRouteComponent } from './-policy-route-components'

const privacyPage = publicPolicyPages.privacy

export const Route = createFileRoute('/privacy')({
  head: () => publicPageHead(privacyPage.head),
  component: PrivacyRouteComponent,
})
