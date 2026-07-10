import { createFileRoute } from '@tanstack/react-router'
import { CampaignSelectionRouteComponent } from './-campaign-selection-route'

export const Route = createFileRoute('/_app/_authed/campaigns/')({
  component: CampaignSelectionRouteComponent,
})
