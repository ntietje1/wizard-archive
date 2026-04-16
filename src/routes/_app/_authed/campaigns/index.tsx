import { createFileRoute } from '@tanstack/react-router'
import { CampaignSelectionPage } from '~/features/campaigns/pages/campaign-selection-page'

export const Route = createFileRoute('/_app/_authed/campaigns/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <CampaignSelectionPage />
}
