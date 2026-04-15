import { createFileRoute } from '@tanstack/react-router'
import { JoinCampaignPage } from '~/features/campaigns/components/join-campaign-page'

export const Route = createFileRoute('/_app/join/$dmUsername/$campaignSlug/')({
  component: JoinCampaignPage,
})
