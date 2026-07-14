import { createFileRoute } from '@tanstack/react-router'
import { CampaignRedirectPage } from '~/features/campaigns/pages/campaign-redirect-page'

export const Route = createFileRoute('/_app/_authed/campaigns/$campaignId/')({
  component: CampaignRedirectPage,
})
