import { createFileRoute } from '@tanstack/react-router'
import { publicSecurityPage } from '~/features/landing/content/public-policy-pages'
import { publicPageHead } from '~/features/landing/content/public-site'
import { SecurityRouteComponent } from './-policy-route-components'

export const Route = createFileRoute('/security')({
  head: () => publicPageHead(publicSecurityPage.head),
  component: SecurityRouteComponent,
})
