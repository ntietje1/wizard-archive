import { createFileRoute } from '@tanstack/react-router'
import { PublicSecurityPage } from '~/features/landing/components/policy-page'
import { publicSecurityPage } from '~/features/landing/content/public-policy-pages'
import { publicPageHead } from '~/features/landing/content/public-site'

function SecurityRouteComponent() {
  return <PublicSecurityPage page={publicSecurityPage} />
}

export const Route = createFileRoute('/security')({
  head: () => publicPageHead(publicSecurityPage.head),
  component: SecurityRouteComponent,
})
