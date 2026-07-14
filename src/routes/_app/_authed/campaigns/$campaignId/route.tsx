import { createFileRoute } from '@tanstack/react-router'
import { CampaignLayout } from '~/features/campaigns/pages/campaign-layout'

export const Route = createFileRoute('/_app/_authed/campaigns/$campaignId')({
  component: CampaignLayout,
})
