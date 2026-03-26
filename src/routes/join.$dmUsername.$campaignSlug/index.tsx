import { createFileRoute } from '@tanstack/react-router'
import { JoinCampaignPage } from '~/features/campaigns/components/join-campaign-page'

export const Route = createFileRoute('/join/$dmUsername/$campaignSlug/')({
  component: JoinCampaignPage,
})
